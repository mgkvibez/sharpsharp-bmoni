/**
 * Seed script — takes the two sandbox personas from nothing to fully-onboarded
 * NGN users with active CNGN smart wallets, ready for test tokens + transfers.
 *
 * Personas (BMONI sandbox test data — names/BVN must match exactly):
 *   Student: Bunch Dillon  (BVN 95888168924)
 *   Parent:  Samson Jabo   (BVN 22222222222)
 *
 * Idempotent: users already saved in demo-state.json with an active rail are
 * skipped unless --force.
 *
 * Run: BMONI_API_KEY=pk_... npm run seed [-- --force]
 */

import "dotenv/config";
import * as bmoni from "../lib/bmoni";
import * as keystore from "../lib/keystore";
import { deflateSync } from "zlib";
import { Buffer } from "buffer";

const FORCE = process.argv.includes("--force");

const PERSONAS: Record<
  string,
  { firstName: string; lastName: string; bvn: string; nin: string }
> = {
  student: {
    firstName: "Bunch",
    lastName: "Dillon",
    bvn: "95888168924",
    nin: "63184876213",
  },
  parent: {
    firstName: "Samson",
    lastName: "Jabo",
    bvn: "22222222222",
    nin: "18482561982",
  },
};

/** Generate a valid PNG ≥ 2KB (API minimum) for KYC document uploads. */
function makePng(width = 600, height = 600, rgb: [number, number, number] = [70, 120, 200]): Buffer {
  function chunk(ctype: Buffer, data: Buffer): Buffer {
    const c = Buffer.concat([ctype, data]);
    const crc = require("zlib").crc32
      ? 0
      : 0;
    // compute CRC32 manually
    let crcVal = crc32(c);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, c, crcBuf]);
  }
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
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(rgb).subarray(0, 3).length === 3 ? Buffer.from([...rgb, ...rgb, ...rgb]) : Buffer.alloc(width * 3)]);
  // build one row properly
  const pixel = Buffer.from(rgb);
  const rowPixels = Buffer.alloc(width * 3);
  for (let i = 0; i < width; i++) pixel.copy(rowPixels, i * 3);
  const raw = Buffer.concat([Buffer.from([0]), rowPixels]);
  const idat = deflateSync(Buffer.concat(Array(height).fill(raw)));
  return Buffer.concat([
    sig,
    chunk(Buffer.from("IHDR"), ihdr),
    chunk(Buffer.from("IDAT"), idat),
    chunk(Buffer.from("IEND"), Buffer.alloc(0)),
  ]);
}

function log(step: string, msg: string) {
  console.log(`  [${step}] ${msg}`);
}

async function onboardPersona(role: "student" | "parent") {
  const p = PERSONAS[role];
  let state = keystore.loadState();
  const existing = state.users[role];

  console.log(`\n============ ${role.toUpperCase()}: ${p.firstName} ${p.lastName} ============`);

  // Skip if already fully onboarded
  if (
    existing?.bmoniUserId &&
    existing?.onboardingStatus?.includes("active") &&
    !FORCE
  ) {
    console.log(`  Already onboarded (user ${existing.bmoniUserId}). Skipping. Use --force to redo.`);
    return existing;
  }

  // 1. Create the user (retry with fresh random phone on conflict)
  let user: bmoni.BmoniUser | null = null;
  let phone = "";
  for (let attempt = 0; attempt < 5 && !user; attempt++) {
    phone = bmoni.generateUniquePhone();
    const email = `${p.firstName}.${p.lastName}.sharpsharp.${Date.now()}@example.com`;
    try {
      user = await bmoni.createUser({
        firstName: p.firstName,
        lastName: p.lastName,
        email,
        phoneNumber: phone,
      });
      log("user", `created — ${user.bmoniUserId}`);
    } catch (e: any) {
      if (e.status === 409 && attempt < 4) {
        log("user", "phone/email conflict — retrying…");
        continue;
      }
      throw e;
    }
  }
  if (!user) throw new Error("Could not create user after retries");
  const userId = user.bmoniUserId;

  // 2. BVN lookup — gives exact name/DOB that verification matches
  log("kyc", "BVN lookup…");
  const bvnRecord = await bmoni.bvnLookup(userId, p.bvn);
  const dob = bvnRecord.dateOfBirth ?? "1995-07-07";
  const gender = (bvnRecord.gender ?? "male").toLowerCase();
  log("kyc", `record: ${bvnRecord.firstName} ${bvnRecord.lastName}, DOB ${dob}`);

  // 3. KYC profile — personal info + address (from BVN record) + source of funds
  log("kyc", "submitting KYC profile…");
  const kycResult = await bmoni.submitKycProfile(userId, {
    personalInfo: {
      firstName: bvnRecord.firstName ?? p.firstName,
      lastName: bvnRecord.lastName ?? p.lastName,
      dateOfBirth: dob,
      gender,
    },
    address: {
      streetLine1: bvnRecord.residentialAddress ?? "15 Admiralty Way",
      city: "Lagos",
      state: bvnRecord.stateOfResidence ?? "Lagos",
      postalCode: "100001",
      countryCode: "NGA",
    },
    sourceOfFunds: "salary",
  });
  log("kyc", `canActivate=${kycResult.canActivate} missing=[${kycResult.missing?.join(", ") ?? "none"}]`);

  // 4. Owner key (reuse if seeded before)
  let key = keystore.getKey(state, role);
  if (!key) {
    key = keystore.generateKey(role);
    keystore.putKey(state, key);
  }
  log("wallet", `owner key ${key.address}`);

  // 5. Owner-proof challenge → EIP-191 sign → create managed wallet
  log("wallet", "owner-proof challenge…");
  const challenge = await bmoni.createOwnerProofChallenge(userId, "CNGN", key.address);
  const ownerProofSignature = await keystore.signOwnerProof(key, challenge.message);
  log("wallet", "creating managed smart wallet…");

  let wallet: bmoni.SmartWallet | null = null;
  try {
    wallet = await bmoni.createManagedWallet(userId, {
      currency: "CNGN",
      userOwnerAddress: key.address,
      ownerProofChallengeId: challenge.challengeId,
      ownerProofSignature,
    });
    log("wallet", `wallet ${wallet.smartWalletId} @ ${wallet.address}`);
  } catch (e: any) {
    log("wallet", `create said: ${e.message}`);
  }

  if (!wallet) {
    const wallets = await bmoni.listWallets(userId);
    if (wallets.length) {
      const w = wallets[0];
      wallet = {
        smartWalletId: w.id ?? w.smartWalletId,
        address: w.address,
        currency: "CNGN",
        status: w.status ?? "ACTIVE",
      };
      log("wallet", `recovered wallet ${wallet.smartWalletId}`);
    }
  }
  if (!wallet) throw new Error("No wallet available");

  // 6. NGN onboarding (BVN + wallet) — issues the virtual bank account
  log("rail", "starting Nigeria onboarding…");
  try {
    await bmoni.startNigeriaOnboarding(userId, {
      bvn: p.bvn,
      ngnWalletAddress: wallet.address,
      ngnWalletIndex: 0,
    });
    log("rail", "onboarding started");
  } catch (e: any) {
    log("rail", `onboarding said: ${e.message}`);
  }

  // 7. KYC documents (only if still missing)
  if (kycResult.missing?.some((m) => m.includes("Documents"))) {
    const png = makePng();
    log("kyc", `uploading documents (${(png.length / 1024).toFixed(1)}KB png)…`);
    for (const [docType, opts] of [
      ["identification", { type: "national_id", documentNumber: p.nin, issuingCountry: "NGA" }],
      ["proof-of-address", { type: "utility_bill" }],
      ["biometric", { type: "selfie" }],
    ] as [bmoni.KycDocType, any][]) {
      try {
        await bmoni.uploadKycDocument(userId, docType, new Blob([png], { type: "image/png" }), opts);
        log("kyc", `uploaded ${docType}`);
      } catch (e: any) {
        log("kyc", `${docType} said: ${e.message}`);
      }
    }
  }

  // 8. Wait for the NGN rail (anchorStatus) to activate
  log("rail", "waiting for NGN rail (anchorStatus)…");
  const status = await bmoni.waitForOnboarding(userId, {
    rail: "anchorStatus",
    timeoutMs: 90_000,
    intervalMs: 6_000,
    onTick: (s) => log("rail", `anchor=${s.anchorStatus}`),
  });
  const anchor = bmoni.railStatus(status, "anchorStatus");
  log("rail", `NGN rail: ${anchor}`);

  // 9. Persist
  state = keystore.loadState();
  state.users[role] = {
    ...(state.users[role] ?? {}),
    bmoniUserId: userId,
    email: user.email,
    phone,
    name: `${bvnRecord.firstName ?? p.firstName} ${bvnRecord.lastName ?? p.lastName}`,
    bvn: p.bvn,
    smartWalletId: wallet.smartWalletId,
    walletAddress: wallet.address,
    currency: "CNGN",
    onboardingStatus: anchor,
  };
  keystore.saveState(state);
  console.log(`  ✅ ${role} ready — user=${userId} wallet=${wallet.address} rail=${anchor}`);
  return state.users[role];
}

async function main() {
  if (!bmoni.BMONI.apiKeyPresent) {
    console.error("Missing BMONI_API_KEY environment variable.");
    process.exit(1);
  }

  console.log(`SharpSharp seeder — ${bmoni.BMONI.baseUrl}${FORCE ? " (force)" : ""}`);

  await onboardPersona("student");
  await onboardPersona("parent");

  const state = keystore.loadState();
  console.log("\n============ SUMMARY ============");
  for (const [role, u] of Object.entries(state.users)) {
    console.log(
      `  ${role.padEnd(8)} ${u.name} | user=${u.bmoniUserId} | wallet=${u.walletAddress} | rail=${u.onboardingStatus}`
    );
  }
  console.log("\nNEXT: request sandbox test tokens (NGN 1,000 + USD 10):");
  console.log("      https://bkey.mintlify.app/request-test-tokens");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
