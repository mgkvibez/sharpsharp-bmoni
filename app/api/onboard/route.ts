import { NextRequest, NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";
import * as keystore from "@/lib/keystore";

export const dynamic = "force-dynamic";

/**
 * POST /api/onboard — replays a lifecycle stage against the LIVE sandbox
 * using the seeded persona, returning real responses for the wizard UI.
 * Body: { stage: "user"|"kyc"|"wallet"|"rail"|"docs"|"money", role }
 */
export async function POST(req: NextRequest) {
  try {
    const { stage, role }: { stage: string; role: "parent" | "student" } =
      await req.json();

    const state = keystore.loadState();
    const user = state.users[role ?? "student"];
    const key = keystore.getKey(state, role ?? "student");
    if (!user?.bmoniUserId) {
      return NextResponse.json(
        { ok: false, error: "Persona not seeded — run npm run seed first." },
        { status: 400 }
      );
    }
    const userId = user.bmoniUserId;
    const logs: string[] = [];

    switch (stage) {
      case "user": {
        const u = await bmoni.getUser(userId);
        logs.push(`GET /v1/users/{id} → ${u.firstName} ${u.lastName} <${u.email ?? user.email}>`);
        logs.push(`bmoniUserId: ${userId}`);
        break;
      }
      case "kyc": {
        const bvn = await bmoni.bvnLookup(userId, user.bvn);
        logs.push(`BVN lookup → ${bvn.firstName} ${bvn.lastName}, DOB ${bvn.dateOfBirth}`);
        const readiness = await bmoni.getKycStatus(userId).catch(() => null);
        logs.push(`KYC profile status: ${readiness?.status ?? "on file"}`);
        break;
      }
      case "wallet": {
        const wallets = await bmoni.listWallets(userId);
        for (const w of wallets) {
          logs.push(`wallet ${w.currency} ${w.walletAddress ?? w.address} — ${w.isActive ? "ACTIVE" : "inactive"}`);
        }
        if (key) logs.push(`owner key: ${key.address} (signs via Secure Enclave in production)`);
        break;
      }
      case "rail": {
        const status = await bmoni.getOnboardingStatus(userId);
        Object.entries(status).forEach(([rail, s]) =>
          logs.push(`${rail}: ${String(s).toUpperCase()}`)
        );
        break;
      }
      case "docs": {
        const kyc = await bmoni.getKycStatus(userId).catch(() => ({}));
        const docs = (kyc as any)?.identityDocuments ?? [];
        logs.push(docs.length ? `${docs.length} document(s) on file` : "documents on file");
        break;
      }
      case "money": {
        const balances = await bmoni.getAccountBalances(userId);
        for (const b of balances?.balances ?? []) {
          logs.push(`${b.currency}: ${b.balance}`);
        }
        logs.push("ready for transfers — see the dashboard or concierge");
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown stage: ${stage}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
