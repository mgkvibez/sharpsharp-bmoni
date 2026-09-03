/**
 * Complete the lifecycle for an existing, KYC-complete user:
 *   owner-proof challenge → create managed wallet → start Nigeria onboarding
 *
 * Run: BMONI_API_KEY=pk_... npx tsx scripts/complete-user.ts <userId> <bvn> <role>
 */

import "dotenv/config";
import { ethers } from "ethers";
import * as bmoni from "../lib/bmoni";
import * as keystore from "../lib/keystore";
import fs from "fs";

async function main() {
  const [userId, bvn, role] = process.argv.slice(2);
  if (!userId || !bvn || !role) {
    console.error("Usage: npx tsx scripts/complete-user.ts <userId> <bvn> <role>");
    process.exit(1);
  }

  const state = keystore.loadState();

  // Owner key: reuse or generate
  let key = keystore.getKey(state, role);
  if (!key) {
    key = keystore.generateKey(role);
    keystore.putKey(state, key);
  }
  console.log(`Owner key: ${key.address}`);

  // 1. Owner-proof challenge
  console.log("\n[wallet] Requesting owner-proof challenge…");
  const challenge = await bmoni.createOwnerProofChallenge(
    userId,
    "CNGN",
    key.address
  );
  console.log(`Challenge id: ${challenge.challengeId}`);

  // 2. Sign (EIP-191) + create managed wallet
  console.log("[wallet] Signing challenge (EIP-191 personal_sign)…");
  const ownerProofSignature = await keystore.signOwnerProof(key, challenge.message);

  console.log("[wallet] Creating managed smart wallet…");
  let wallet;
  try {
    wallet = await bmoni.createManagedWallet(userId, {
      currency: "CNGN",
      userOwnerAddress: key.address,
      ownerProofChallengeId: challenge.challengeId,
      ownerProofSignature,
    });
    console.log(`Wallet created: ${wallet.smartWalletId} @ ${wallet.address}`);
  } catch (e: any) {
    console.log(`Wallet creation said: ${e.message}`);
    const wallets = await bmoni.listWallets(userId);
    console.log("Existing wallets:", JSON.stringify(wallets).slice(0, 400));
    wallet = wallets[0]
      ? {
          smartWalletId: wallets[0].id ?? wallets[0].smartWalletId,
          address: wallets[0].address,
          currency: "CNGN",
          status: wallets[0].status ?? "ACTIVE",
        }
      : null;
  }

  if (!wallet) throw new Error("No wallet available");

  // 3. Start Nigeria onboarding
  console.log("\n[rail] Starting Nigeria onboarding…");
  try {
    await bmoni.startNigeriaOnboarding(userId, {
      bvn,
      ngnWalletAddress: wallet.address,
      ngnWalletIndex: 0,
    });
    console.log("Onboarding started.");
  } catch (e: any) {
    console.log(`Onboarding said: ${e.message}`);
  }

  // 4. Poll status
  console.log("\n[rail] Polling onboarding status…");
  const status = await bmoni.waitForOnboarding(userId, {
    timeoutMs: 90_000,
    intervalMs: 6_000,
    onTick: (s) => console.log(`  status: ${JSON.stringify(s).slice(0, 300)}`),
  });
  console.log(`\nFinal onboarding status: ${JSON.stringify(status).slice(0, 400)}`);

  // 5. Save
  const users = state.users ?? {};
  users[role] = {
    ...(users[role] ?? {}),
    bmoniUserId: userId,
    bvn,
    smartWalletId: wallet.smartWalletId,
    walletAddress: wallet.address,
    currency: "CNGN",
    onboardingStatus: status.status,
  };
  state.users = users;
  keystore.saveState(state);
  console.log("\nSaved to demo-state.json");
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
