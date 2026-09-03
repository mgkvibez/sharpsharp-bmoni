/**
 * Demo key management + BMONI signing helpers.
 *
 * PRODUCTION NOTE: In a real deployment, private keys never leave the device —
 * bmoni_embedded_sdk provisions secp256k1 wallets into Android Keystore /
 * iOS Secure Enclave and signs there. This server-side keystore exists ONLY
 * for the sandbox demo, where the "device" is our demo server.
 *
 * Two signing modes exist in the BMONI flow — using the wrong one fails:
 *   1. Owner-proof challenge  → EIP-191 signed MESSAGE (wallet.signMessage)
 *   2. Proposal signing         → RAW 32-byte digest   (signingKey.sign(h).serialized)
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";

export interface KeyRecord {
  role: string; // "student" | "parent"
  address: string;
  privateKey: string;
}

export interface DemoPersona {
  bmoniUserId: string;
  email?: string;
  phone?: string;
  name?: string;
  bvn?: string;
  smartWalletId?: string;
  walletAddress?: string;
  currency?: string;
  onboardingStatus?: string;
  bankAccountId?: string;
}

export interface DemoState {
  users: Record<string, DemoPersona>;
  keys: Record<string, KeyRecord>;
  createdAt: string;
}

const STATE_FILE = path.join(process.cwd(), "demo-state.json");

export function loadState(): DemoState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }
  return { users: {}, keys: {}, createdAt: new Date().toISOString() };
}

export function saveState(state: DemoState) {
  state.createdAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Generate a fresh ephemeral owner wallet for a demo persona. */
export function generateKey(role: string): KeyRecord {
  const wallet = ethers.Wallet.createRandom();
  return {
    role,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export function getWallet(record: KeyRecord): ethers.Wallet {
  return new ethers.Wallet(record.privateKey);
}

/**
 * Signature type 1 — EIP-191 signed message (for owner-proof challenges).
 * ethers' signMessage applies the personal_sign prefix automatically.
 */
export async function signOwnerProof(
  key: KeyRecord,
  message: string
): Promise<string> {
  const wallet = getWallet(key);
  return wallet.signMessage(message);
}

/**
 * Signature type 2 — RAW 32-byte digest (for proposal signing).
 * No EIP-191 prefix. signingKey.sign(), NOT signMessage().
 */
export async function signRawHash(
  key: KeyRecord,
  hashToSign: string
): Promise<string> {
  const wallet = getWallet(key);
  return wallet.signingKey.sign(hashToSign).serialized;
}

/**
 * Signature type 3 — EIP-712 typed data (proposal sign-payloads).
 * BMONI returns a CoinbaseSmartWalletMessage typed-data structure;
 * sign it with signTypedData — NOT signMessage, NOT raw digest.
 */
export async function signTypedDataPayload(
  key: KeyRecord,
  typedData: {
    domain: any;
    types: any;
    message: any;
    primaryType?: string;
  }
): Promise<string> {
  const wallet = getWallet(key);
  const { domain, types, message, primaryType } = typedData;
  // Strip EIP712Domain from types if present (ethers derives it from domain)
  const cleanTypes = { ...types };
  delete cleanTypes.EIP712Domain;
  return wallet.signTypedData(domain, cleanTypes, message);
}

/** Save a key into demo state. */
export function putKey(state: DemoState, key: KeyRecord) {
  state.keys[key.role] = key;
}

export function getKey(state: DemoState, role: string): KeyRecord | null {
  return state.keys[role] ?? null;
}
