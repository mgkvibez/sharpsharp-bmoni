/** Local signature sanity check for the parent's owner key. */

import "dotenv/config";
import { ethers } from "ethers";
import * as keystore from "../lib/keystore";

async function main() {
  const state = keystore.loadState();
  const key = keystore.getKey(state, "parent")!;
  const wallet = new ethers.Wallet(key.privateKey);
  console.log("parent owner address:", wallet.address);

  const payload = {
    domain: {
      chainId: 84532,
      name: "Coinbase Smart Wallet",
      verifyingContract: "0xE904fafcAfe3009E2bDd88F190B2a0ad100210d3",
      version: "1",
    },
    types: {
      CoinbaseSmartWalletMessage: [{ name: "hash", type: "bytes32" }],
    },
    primaryType: "CoinbaseSmartWalletMessage",
    message: {
      hash: "0x7b6cade75cb31a49b367c371ad7c2c9d920ce4526de50e87e2715e8e297274b8",
    },
  };

  const sig = await wallet.signTypedData(
    payload.domain,
    payload.types,
    payload.message
  );
  console.log("typed-data signature:", sig);
  const recovered = ethers.verifyTypedData(
    payload.domain,
    payload.types,
    payload.message,
    sig
  );
  console.log("recovers to:", recovered);
  console.log("match:", recovered === wallet.address);

  // Also try raw-digest signing for comparison
  const rawSig = wallet.signingKey.sign(payload.message.hash).serialized;
  console.log("raw-digest signature:", rawSig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
