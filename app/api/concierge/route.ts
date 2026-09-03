import { NextRequest, NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";
import * as keystore from "@/lib/keystore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/concierge — conversational money assistant.
 * Parses intents from natural language and executes real BMONI flows:
 *
 *   "send 500 naira to my student"   → full transfer lifecycle
 *   "what's my balance"              → wallet balances
 *   "withdraw 200 to GTBank"         → NGN bank withdrawal
 *   "help"                           → capabilities
 */

interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
}

const NIGERIA_PATTERN = /(\d[\d,.]*)\s*(k|thousand|m|million)?/i;

function parseAmount(text: string): number | null {
  const match = text.match(NIGERIA_PATTERN);
  if (!match) return null;
  let n = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(n)) return null;
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k" || suffix === "thousand") n *= 1_000;
  if (suffix === "m" || suffix === "million") n *= 1_000_000;
  return n > 0 ? n : null;
}

function parseTarget(text: string): "parent" | "student" | null {
  const t = text.toLowerCase();
  if (/(student|child|ward|bunch|son|daughter|school)/.test(t)) return "student";
  if (/(parent|mum|mom|dad|father|mother|samson|sender|abroad)/.test(t)) return "parent";
  return null;
}

function fmtN(n: number): string {
  return `₦${n.toLocaleString("en-NG")}`;
}

async function handleSend(text: string, from: "parent" | "student") {
  const amount = parseAmount(text);
  const target = parseTarget(text);
  if (!amount) {
    return "How much would you like to send? Try: “send 500 naira to my student”.";
  }
  if (!target || target === from) {
    return from === "parent"
      ? "Who should receive it? Try: “send 500 naira to my student”."
      : "Who should receive it? Try: “send 500 naira to my parent”.";
  }

  const state = keystore.loadState();
  const sender = state.users[from];
  const recipient = state.users[target];
  const key = keystore.getKey(state, from);
  if (!sender?.bmoniUserId || !recipient?.bmoniUserId || !key) {
    return "The demo personas aren't seeded yet — run `npm run seed` first.";
  }

  const events: string[] = [];
  const result = await bmoni.executeTransfer({
    userId: sender.bmoniUserId,
    smartWalletId: sender.smartWalletId!,
    toUserId: recipient.bmoniUserId,
    amount: String(amount),
    currency: "CNGN",
    description: "Sent via SharpSharp concierge",
    signRawHash: (h) => keystore.signRawHash(key, h),
    signTypedData: (td) => keystore.signTypedDataPayload(key, td),
    onStatus: (s) => events.push(s),
  });

  if (result.status === "COMPLETED") {
    return `✅ Sent ${fmtN(amount)} to ${recipient.name}. The transfer went through the full BMONI flow — proposal, approval, owner-key signature, and on-chain settlement.`;
  }
  return `Transfer reached status ${result.status}. Proposal ID: ${result.proposalId}. ${result.status === "FAILED" ? "The wallet balance may be too low — request sandbox test tokens." : ""}`;
}

async function handleBalance(role: "parent" | "student") {
  const state = keystore.loadState();
  const user = state.users[role];
  if (!user?.bmoniUserId) return "No wallet found for this persona yet.";
  const res = await bmoni.getAccountBalances(user.bmoniUserId);
  const balances = res?.balances ?? [];
  if (!balances.length) return "No active wallet yet — run the onboarding wizard first.";
  return balances
    .map((b: any) => `${b.currency}: ${b.balance}${b.error ? ` (error: ${b.error})` : ""}`)
    .join(" · ");
}

async function handleWithdraw(text: string, role: "parent" | "student") {
  const amount = parseAmount(text);
  if (!amount) {
    return "How much? Try: “withdraw 200 to my bank” (uses the registered account).";
  }
  const state = keystore.loadState();
  const user = state.users[role];
  const key = keystore.getKey(state, role);
  if (!user?.bmoniUserId || !key) return "Persona not seeded.";

  // Use the first registered withdrawal account, or a demo one
  const accounts = await bmoni.listWithdrawalAccounts(user.bmoniUserId).catch(() => []);
  let bankAccountId: string | undefined = accounts?.[0]?.id;

  if (!bankAccountId) {
    // Register a demo account on the fly
    const banks = await bmoni.listNigerianBanks(user.bmoniUserId).catch(() => []);
    const bank = banks?.find((b: any) => /guaranty|gt/i.test(b.name)) ?? banks?.[0];
    if (!bank) return "Could not list banks for the withdrawal.";
    const registered = await bmoni.registerWithdrawalAccount(user.bmoniUserId, {
      accountNumber: "0123456789",
      bankCode: bank.code,
      bankName: bank.name,
      accountHolderName: user.name,
    });
    bankAccountId = registered.bankAccountId;
  }

  const result = await bmoni.executeNgnWithdrawal({
    userId: user.bmoniUserId,
    smartWalletId: user.smartWalletId!,
    bankAccountId: bankAccountId!,
    fromAmount: String(amount),
    signRawHash: (h) => keystore.signRawHash(key, h),
    signTypedData: (td) => keystore.signTypedDataPayload(key, td),
  });

  if (result.status === "COMPLETED") {
    return `✅ Withdrawal of ${fmtN(amount)} submitted to the bank account. Status: COMPLETED.`;
  }
  return `Withdrawal status: ${result.status}. ${result.status === "FAILED" ? "Balance may be insufficient — request sandbox test tokens." : ""}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = (body.message ?? "").toLowerCase().trim();
    const role: "parent" | "student" = body.role === "student" ? "student" : "parent";

    if (!text) {
      return NextResponse.json({ ok: true, reply: "Ask me to send money, check a balance, or withdraw to a bank. Try “send 500 naira to my student”." });
    }

    let reply: string;
    if (/help|what can you do|commands/.test(text)) {
      reply =
        "I can move real money through the BMONI rails. Try:\n• “send 500 naira to my student”\n• “what's my balance”\n• “withdraw 200 to my bank”";
    } else if (/balance|how much do i have/.test(text)) {
      reply = await handleBalance(role);
    } else if (/^(send|transfer|pay)/.test(text)) {
      reply = await handleSend(text, role);
    } else if (/^(withdraw|cash out|offramp)/.test(text)) {
      reply = await handleWithdraw(text, role);
    } else {
      reply = "I didn't catch that. Try “send 500 naira to my student”, “balance”, or “withdraw 200 to my bank”.";
    }

    return NextResponse.json({ ok: true, reply });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reply: `Something went wrong: ${e.message}` });
  }
}
