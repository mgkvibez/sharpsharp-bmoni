import { NextRequest, NextResponse } from "next/server";
import * as bmoni from "@/lib/bmoni";
import * as keystore from "@/lib/keystore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/transfer — full BMONI transfer lifecycle:
 *   proposal → approve → sign-payload → owner-key sign → settled status
 *
 * Body: { from: "parent"|"student", toRole?: "parent"|"student",
 *         toAddress?: string, amount: string, description?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      from,
      toRole,
      toAddress,
      amount,
      description,
    }: {
      from: "parent" | "student";
      toRole?: "parent" | "student";
      toAddress?: string;
      amount: string;
      description?: string;
    } = body;

    const state = keystore.loadState();
    const sender = state.users[from];
    const key = keystore.getKey(state, from);
    if (!sender?.bmoniUserId || !sender?.smartWalletId || !key) {
      return NextResponse.json(
        { ok: false, error: `Persona "${from}" is not seeded. Run npm run seed.` },
        { status: 400 }
      );
    }

    const recipient = toRole ? state.users[toRole] : null;
    const target =
      recipient?.bmoniUserId
        ? { toUserId: recipient.bmoniUserId }
        : toAddress
          ? { toAddress }
          : null;
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Provide toRole or toAddress" },
        { status: 400 }
      );
    }

    const events: string[] = [];
    const result = await bmoni.executeTransfer({
      userId: sender.bmoniUserId,
      smartWalletId: sender.smartWalletId,
      ...target,
      amount: String(amount),
      currency: "CNGN",
      description: description ?? "SharpSharp transfer",
      signRawHash: (h) => keystore.signRawHash(key, h),
      signTypedData: (td) => keystore.signTypedDataPayload(key, td),
      onStatus: (s) => events.push(s),
    });

    return NextResponse.json({
      ok: result.status === "COMPLETED",
      status: result.status,
      proposalId: result.proposalId,
      events,
      from: sender.name,
      to: recipient?.name ?? toAddress,
      amount,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message, status: e.status ?? 500 },
      { status: 200 } // keep 200 so the UI can show the error text nicely
    );
  }
}
