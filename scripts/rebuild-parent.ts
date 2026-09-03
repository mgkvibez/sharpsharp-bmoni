/**
 * Rebuild the parent persona end-to-end with a persisted owner key.
 * (The original parent user's wallet key was lost in a crash — a user can
 * hold at most one wallet per currency, so the fresh user gets a fresh wallet.)
 * Key is persisted BEFORE any network call that could crash.
 */

import "dotenv/config";
import * as bmoni from "../lib/bmoni";
import * as keystore from "../lib/keystore";
import { deflateSync } from "zlib";

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng(): Buffer {
  const width = 600, height = 600;
  const chunk = (ctype: string, data: Buffer) => {
    const c = Buffer.concat([Buffer.from(ctype), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(c));
    return Buffer.concat([len, c, crcBuf]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const rowPixels = Buffer.alloc(width * 3);
  for (let i = 0; i < width; i++) { rowPixels[i*3]=70; rowPixels[i*3+1]=120; rowPixels[i*3+2]=200; }
  const raw = Buffer.concat([Buffer.from([0]), rowPixels]);
  const idat = deflateSync(Buffer.concat(Array(height).fill(raw)));
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  const state = keystore.loadState();

  // 0. Persist a fresh key FIRST — crash-proof
  const key = keystore.generateKey("parent");
  keystore.putKey(state, key);
  keystore.saveState(state);
  console.log(`[key] owner ${key.address} persisted`);

  // 1. Fresh user
  const phone = bmoni.generateUniquePhone();
  const user = await bmoni.createUser({
    firstName: "Samson",
    lastName: "Jabo",
    email: `samson.jabo.parent.${Date.now()}@example.com`,
    phoneNumber: phone,
  });
  const userId = user.bmoniUserId;
  console.log(`[user] created ${userId}`);
  // persist immediately
  const s1 = keystore.loadState();
  s1.users.parent = {
    ...(s1.users.parent ?? {}),
    bmoniUserId: userId,
    email: user.email,
    phone,
    name: "Samson Jabo",
    bvn: "22222222222",
  };
  keystore.saveState(s1);

  // 2. BVN + KYC profile
  const bvn = await bmoni.bvnLookup(userId, "22222222222");
  console.log(`[kyc] BVN record: ${bvn.firstName} ${bvn.lastName}, DOB ${bvn.dateOfBirth}`);
  const kyc = await bmoni.submitKycProfile(userId, {
    personalInfo: {
      firstName: bvn.firstName ?? "Samson",
      lastName: bvn.lastName ?? "Jabo",
      dateOfBirth: bvn.dateOfBirth ?? "1995-07-07",
      gender: (bvn.gender ?? "male").toLowerCase(),
    },
    address: {
      streetLine1: bvn.residentialAddress ?? "15 Admiralty Way",
      city: "Lagos",
      state: bvn.stateOfResidence ?? "Lagos",
      postalCode: "100001",
      countryCode: "NGA",
    },
    sourceOfFunds: "business",
  });
  console.log(`[kyc] profile saved, canActivate=${kyc.canActivate}, missing=[${kyc.missing.join(", ")}]`);

  // 3. Wallet (key already persisted)
  const challenge = await bmoni.createOwnerProofChallenge(userId, "CNGN", key.address);
  const sig = await keystore.signOwnerProof(key, challenge.message);
  const wallet = await bmoni.createManagedWallet(userId, {
    currency: "CNGN",
    userOwnerAddress: key.address,
    ownerProofChallengeId: challenge.challengeId,
    ownerProofSignature: sig,
  });
  console.log(`[wallet] ${wallet.smartWalletId} @ ${wallet.address}`);
  const s2 = keystore.loadState();
  s2.users.parent.smartWalletId = wallet.smartWalletId;
  s2.users.parent.walletAddress = wallet.address;
  keystore.saveState(s2);

  // 4. NGN onboarding
  await bmoni.startNigeriaOnboarding(userId, {
    bvn: "22222222222",
    ngnWalletAddress: wallet.address,
    ngnWalletIndex: 0,
  });
  console.log(`[rail] onboarding started`);

  // 5. Documents (BVN as documentNumber — verified working)
  const png = makePng();
  await bmoni.uploadKycDocument(userId, "identification", new Blob([png], { type: "image/png" }), {
    type: "national_id", documentNumber: "22222222222", issuingCountry: "NGA",
  });
  console.log(`[kyc] identification ✓`);
  await bmoni.uploadKycDocument(userId, "proof-of-address", new Blob([png], { type: "image/png" }), { type: "utility_bill" });
  console.log(`[kyc] proof-of-address ✓`);
  await bmoni.uploadKycDocument(userId, "biometric", new Blob([png], { type: "image/png" }), { type: "selfie" });
  console.log(`[kyc] biometric ✓`);

  // 6. Wait for rail
  const status = await bmoni.waitForOnboarding(userId, {
    rail: "anchorStatus",
    timeoutMs: 90_000,
    intervalMs: 6_000,
    onTick: (s) => console.log(`  anchor: ${s.anchorStatus}`),
  });

  const s3 = keystore.loadState();
  s3.users.parent.onboardingStatus = status.anchorStatus ?? "unknown";
  keystore.saveState(s3);
  console.log(`\n✅ parent rebuilt — user=${userId} wallet=${wallet.address} rail=${status.anchorStatus}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
