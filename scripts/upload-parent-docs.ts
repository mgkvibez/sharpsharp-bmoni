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
  const userId = process.argv[2];
  const png = makePng();
  console.log(`PNG: ${(png.length/1024).toFixed(1)}KB`);
  await bmoni.uploadKycDocument(userId, "identification", new Blob([png], { type: "image/png" }), {
    type: "national_id", documentNumber: "18482561982", issuingCountry: "NGA",
  });
  console.log("identification ✓");
  await bmoni.uploadKycDocument(userId, "proof-of-address", new Blob([png], { type: "image/png" }), { type: "utility_bill" });
  console.log("proof-of-address ✓");
  await bmoni.uploadKycDocument(userId, "biometric", new Blob([png], { type: "image/png" }), { type: "selfie" });
  console.log("biometric ✓");

  const readiness = await bmoni.getKycReadiness(userId);
  console.log("readiness:", JSON.stringify(readiness).slice(0, 300));

  // Wait for rail
  const status = await bmoni.waitForOnboarding(userId, {
    rail: "anchorStatus", timeoutMs: 90_000, intervalMs: 6_000,
    onTick: (s) => console.log("anchor:", s.anchorStatus),
  });
  console.log("final anchor:", status.anchorStatus);

  const state = keystore.loadState();
  state.users.parent = {
    ...(state.users.parent ?? {}),
    bmoniUserId: userId,
    name: "Samson Jabo",
    bvn: "22222222222",
    smartWalletId: state.users.parent?.smartWalletId ?? "c471a396-b49c-4503-93f6-dd18ee7b6924",
    walletAddress: state.users.parent?.walletAddress ?? "0xc7dB12A677B0c4DDE23eE68199314E7bE1eE65F9",
    currency: "CNGN",
    onboardingStatus: status.anchorStatus ?? "unknown",
  };
  keystore.saveState(state);
  console.log("state saved");
}
main().catch(e => { console.error(e); process.exit(1); });
