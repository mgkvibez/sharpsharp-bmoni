import "dotenv/config";
import { ethers } from "ethers";
import * as bmoni from "../lib/bmoni";
import * as keystore from "../lib/keystore";

/**
 * The seed crashed before persisting the parent's owner key, so the original
 * wallet (0xc7dB...) is orphaned. Mint a fresh wallet with a persisted key,
 * re-run Nigeria onboarding against it, and save everything atomically.
 */
async function main() {
  const state = keystore.loadState();
  const user = state.users.parent;
  const userId = user.bmoniUserId;

  // 1. Fresh key — persisted IMMEDIATELY this time
  const key = keystore.generateKey("parent");
  keystore.putKey(state, key);
  keystore.saveState(state); // save before anything can crash
  console.log(`owner key: ${key.address} (persisted)`);

  // 2. Owner-proof → create new wallet
  const challenge = await bmoni.createOwnerProofChallenge(userId, "CNGN", key.address);
  const ownerProofSignature = await keystore.signOwnerProof(key, challenge.message);
  const wallet = await bmoni.createManagedWallet(userId, {
    currency: "CNGN",
    userOwnerAddress: key.address,
    ownerProofChallengeId: challenge.challengeId,
    ownerProofSignature,
  });
  console.log(`new wallet: ${wallet.smartWalletId} @ ${wallet.address}`);

  // 3. Re-run Nigeria onboarding pointing at the NEW wallet
  try {
    await bmoni.startNigeriaOnboarding(userId, {
      bvn: "22222222222",
      ngnWalletAddress: wallet.address,
      ngnWalletIndex: 1,
    });
    console.log("onboarding restarted with new wallet");
  } catch (e: any) {
    console.log(`onboarding said: ${e.message}`);
  }

  // 4. Wait for the rail
  const status = await bmoni.waitForOnboarding(userId, {
    rail: "anchorStatus",
    timeoutMs: 90_000,
    intervalMs: 6_000,
    onTick: (s) => console.log("  anchor:", s.anchorStatus),
  });

  // 5. Persist user binding
  const s2 = keystore.loadState();
  s2.users.parent = {
    ...s2.users.parent,
    smartWalletId: wallet.smartWalletId,
    walletAddress: wallet.address,
    onboardingStatus: status.anchorStatus ?? "unknown",
  };
  keystore.saveState(s2);
  console.log(`done — rail: ${status.anchorStatus}`);
}

main().catch((e) => { console.error("Failed:", e); process.exit(1); });
