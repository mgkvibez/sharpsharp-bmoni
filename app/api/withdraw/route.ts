import { NextRequest, NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";
import * as keystore from "@/lib/keystore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/withdraw — NGN withdrawal to a Nigerian bank account:
 *   banks → verify → register → offramp proposal → approve → sign → settled
 *
 * Body: { role: "student"|"parent", accountNumber, bankCode, bankName,
 *         amount, accountHolderName? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      role,
      accountNumber,
      bankCode,
      bankName,
      amount,
      accountHolderName,
    }: {
      role: "parent" | "student";
      accountNumber: string;
      bankCode: string;
      bankName: string;
      amount: string;
      accountHolderName?: string;
    } = body;

    const state = keystore.loadState();
    const user = state.users[role];
    const key = keystore.getKey(state, role);
    if (!user?.bmoniUserId || !user?.smartWalletId || !key) {
      return NextResponse.json(
        { ok: false, error: `Persona "${role}" is not seeded.` },
        { status: 400 }
      );
    }
    const userId = user.bmoniUserId;

    const events: string[] = [];

    // 1. Verify the account number → exact holder name
    events.push("VERIFYING_ACCOUNT");
    const verified = await bmoni.verifyNigerianAccount(
      userId,
      accountNumber,
      bankCode
    );
    const holderName =
      accountHolderName ?? verified.accountHolderName ?? user.name ?? "Account Holder";
    events.push(`ACCOUNT_VERIFIED:${holderName}`);

    // 2. Register the withdrawal account
    events.push("REGISTERING_ACCOUNT");
    const registered = await bmoni.registerWithdrawalAccount(userId, {
      accountNumber,
      bankCode,
      bankName,
      accountHolderName: holderName,
    });
    events.push("ACCOUNT_REGISTERED");

    // 3. Offramp proposal → approve → sign → settle
    const result = await bmoni.executeNgnWithdrawal({
      userId,
      smartWalletId: user.smartWalletId,
      bankAccountId: registered.bankAccountId,
      fromAmount: String(amount),
      signRawHash: (h) => keystore.signRawHash(key, h),
      signTypedData: (td) => keystore.signTypedDataPayload(key, td),
      onStatus: (s) => events.push(s),
    });

    return NextResponse.json({
      ok: result.status === "COMPLETED",
      status: result.status,
      proposalId: result.proposalId,
      events,
      holderName,
      amount,
      bankName,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message, status: e.status ?? 500 },
      { status: 200 }
    );
  }
}
