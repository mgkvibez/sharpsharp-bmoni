import { NextRequest, NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";

export const dynamic = "force-dynamic";

/** GET /api/banks — supported Nigerian banks (name + CBN code). */
export async function GET() {
  try {
    const state = (await import("@/lib/keystore")).loadState();
    const anyUser = state.users.student ?? state.users.parent;
    if (!anyUser?.bmoniUserId) {
      return NextResponse.json(
        { ok: false, error: "No seeded persona found. Run npm run seed." },
        { status: 400 }
      );
    }
    const banks = await bmoni.listNigerianBanks(anyUser.bmoniUserId);
    return NextResponse.json({ ok: true, banks });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
