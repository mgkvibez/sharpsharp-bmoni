import "dotenv/config";
import * as bmoni from "../lib/bmoni";
import * as keystore from "../lib/keystore";

async function main() {
  const proposalId = process.argv[2];
  const state = keystore.loadState();
  const key = keystore.getKey(state, "parent")!;

  const payload = await bmoni.getSignPayload(state.users.parent.bmoniUserId!, proposalId);
  if (!payload) throw new Error("no payload");
  console.log("hash to sign:", payload.hashToSign);
  console.log("typedData present:", !!payload.typedData);

  // Signature 1: EIP-712 typed data
  if (payload.typedData) {
    const sig = await keystore.signTypedDataPayload(key, payload.typedData);
    console.log("\nSubmitting EIP-712 signature…");
    try {
      const res = await bmoni.submitProposalSignature(state.users.parent.bmoniUserId!, proposalId, sig);
      console.log("RESULT:", JSON.stringify(res).slice(0, 400));
      return;
    } catch (e: any) {
      console.log("EIP-712 rejected:", e.message);
    }
  }

  // Signature 2: raw digest
  const rawSig = await keystore.signRawHash(key, payload.hashToSign);
  console.log("\nSubmitting raw-digest signature…");
  try {
    const res = await bmoni.submitProposalSignature(state.users.parent.bmoniUserId!, proposalId, rawSig);
    console.log("RESULT:", JSON.stringify(res).slice(0, 400));
  } catch (e: any) {
    console.log("raw-digest rejected:", e.message);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
