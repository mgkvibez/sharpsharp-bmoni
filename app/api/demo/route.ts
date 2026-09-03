import { NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";
import * as keystore from "@/lib/keystore";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo — snapshot of both demo personas:
 * users, wallets, balances, and deposit account details.
 */
export async function GET() {
  try {
    if (!bmoni.BMONI.apiKeyPresent) {
      return NextResponse.json({ error: "BMONI_API_KEY not set" }, { status: 500 });
    }

    const state = keystore.loadState();
    const personas: Record<string, any> = {};

    for (const role of ["student", "parent"]) {
      const u = state.users[role];
      if (!u?.bmoniUserId) continue;

      const [walletsRes, balances, deposit] = await Promise.all([
        bmoni.listWallets(u.bmoniUserId).catch(() => []),
        bmoni.getAccountBalances(u.bmoniUserId).catch(() => null),
        bmoni.getDepositAccounts(u.bmoniUserId).catch(() => []),
      ]);

      personas[role] = {
        name: u.name ?? role,
        bmoniUserId: u.bmoniUserId,
        walletAddress: u.walletAddress,
        smartWalletId: u.smartWalletId,
        onboardingStatus: u.onboardingStatus,
        wallets: walletsRes,
        balances: (balances as any)?.balances ?? [],
        depositAccounts: (deposit as any[]) ?? [],
      };
    }

    return NextResponse.json({
      ok: true,
      baseUrl: bmoni.BMONI.baseUrl,
      personas,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
