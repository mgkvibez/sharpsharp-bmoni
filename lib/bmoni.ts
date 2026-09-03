/**
 * BMONI Embedded API client
 * Sandbox: https://embedded-dev.bmoni.com
 * Docs: https://bkey.mintlify.app
 *
 * Covers the full lifecycle:
 *   user → wallet → KYC → rail → fund → move money
 */

const BASE_URL = process.env.BMONI_BASE_URL || "https://embedded-dev.bmoni.com";
const API_KEY = process.env.BMONI_API_KEY || "";

export const BMONI = {
  baseUrl: BASE_URL,
  apiKeyPresent: !!API_KEY,
};

export class BmoniError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "x-api-key": API_KEY,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const msg =
      json?.message || json?.error || text.slice(0, 200) || res.statusText;
    throw new BmoniError(msg, res.status, json?.error || "UNKNOWN");
  }

  return (json ?? {}) as T;
}

/** Multipart file upload (KYC documents). */
async function uploadFile<T>(
  path: string,
  file: Blob,
  filename: string
): Promise<T> {
  const fd = new FormData();
  fd.append("file", file, filename);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "x-api-key": API_KEY },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BmoniError(
      json.message || json.error || `Upload failed (${res.status})`,
      res.status,
      json.error || "UNKNOWN"
    );
  }
  return json as T;
}

const get = <T>(path: string) => call<T>("GET", path);
const post = <T>(path: string, body?: unknown) => call<T>("POST", path, body);
const patch = <T>(path: string, body?: unknown) => call<T>("PATCH", path, body);
const del = <T>(path: string) => call<T>("DELETE", path);

// ---------------------------------------------------------------------------
// 1. USERS
// ---------------------------------------------------------------------------

export interface BmoniUser {
  bmoniUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  createdAt?: string;
}

export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string; // E.164, e.g. +2348000000000
  bvn?: string;
}): Promise<BmoniUser> {
  const res = await post<any>("/v1/users", input);
  const data = res.user ?? res.data ?? res;
  return {
    bmoniUserId: data.bmoniUserId ?? data.id,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: data.phoneNumber,
    createdAt: data.createdAt,
  };
}

export function generateUniquePhone(prefix = "+2348"): string {
  // Nigerian numbers: +234 followed by 10 digits. Random 8 + fixed prefix digits.
  const digits = Math.floor(10000000 + Math.random() * 89999999);
  return `${prefix}${digits}`;
}

export async function getUser(userId: string): Promise<any> {
  return get(`/v1/users/${userId}`);
}

export async function listUsers(): Promise<any[]> {
  const res = await get<any>("/v1/users");
  return res.users ?? res.data ?? [];
}

/** Find an existing sandbox user by email (recover instead of retry-create). */
export async function findUserByEmail(email: string): Promise<any | null> {
  const users = await listUsers();
  return (
    users.find(
      (u: any) => (u.email || "").toLowerCase() === email.toLowerCase()
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// 2. KYC
// ---------------------------------------------------------------------------

/**
 * PATCH /kyc — partial updates accepted; the response returns
 * { success, saved, canActivate, missing[] } which we surface.
 */
export interface KycProfileInput {
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string; // YYYY-MM-DD
    gender?: string;
    phoneNumber?: string;
  };
  address?: {
    streetLine1: string;
    city: string;
    state: string; // valid Nigerian state name
    postalCode: string; // 6 digits
    countryCode: string; // "NGA"
  };
  sourceOfFunds?: string; // salary|business|investments|pension|government|inheritance|savings
  employment?: {
    employmentStatus?: string; // employed|self_employed|retired|student|unemployed|homemaker
    occupationCode?: string; // from GET /kyc/occupations
    employerName?: string;
  };
  [k: string]: any;
}

export interface KycProfileResult {
  success: boolean;
  saved: Record<string, boolean>;
  canActivate: boolean;
  missing: string[];
}

export async function submitKycProfile(
  userId: string,
  profile: KycProfileInput
): Promise<KycProfileResult> {
  return patch(`/v1/users/${userId}/kyc`, profile);
}

export async function bvnLookup(userId: string, bvn: string): Promise<any> {
  return get(`/v1/users/${userId}/kyc/bvn-lookup/${bvn}`);
}

export async function ninLookup(userId: string, nin: string): Promise<any> {
  return get(`/v1/users/${userId}/kyc/nin-lookup/${nin}`);
}

export type KycDocType = "identification" | "proof-of-address" | "biometric";

/**
 * Upload a KYC document. Actual multipart schema (from OpenAPI spec):
 *   identification:  files[] + type + documentNumber + issuingCountry
 *   proof-of-address: files[] + type
 *   biometric:       selfie[] + type
 */
export async function uploadKycDocument(
  userId: string,
  docType: KycDocType,
  file: Blob,
  opts: {
    type?: string; // e.g. "national_id", "utility_bill", "selfie"
    documentNumber?: string;
    issuingCountry?: string;
  } = {}
): Promise<any> {
  const fd = new FormData();
  const fieldName = docType === "biometric" ? "selfie" : "files";
  // Ensure the part has a MIME type — a bare Blob sends application/octet-stream,
  // which the API rejects with E400 "information is invalid".
  const typed =
    file instanceof Blob && file.type
      ? file
      : new Blob([file], { type: "image/png" });
  fd.append(fieldName, typed, "document.png");
  fd.append("type", opts.type ?? "national_id");
  if (opts.documentNumber) fd.append("documentNumber", opts.documentNumber);
  if (opts.issuingCountry) fd.append("issuingCountry", opts.issuingCountry);

  const res = await fetch(
    `${BASE_URL}/v1/users/${userId}/kyc/documents/${docType}`,
    {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: fd,
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BmoniError(
      json.message || json.error || `KYC ${docType} upload failed`,
      res.status,
      json.error || "UNKNOWN"
    );
  }
  return json;
}

/** GET /kyc/options — valid enums for KYC fields. */
export async function getKycOptions(userId: string): Promise<any> {
  return get(`/v1/users/${userId}/kyc/options`);
}

/** GET /kyc/readiness — what's missing before activation. */
export async function getKycReadiness(userId: string): Promise<any> {
  return get(`/v1/users/${userId}/kyc/readiness`);
}

export async function getKycStatus(userId: string): Promise<any> {
  return get(`/v1/users/${userId}/kyc`);
}

// ---------------------------------------------------------------------------
// 3. SMART WALLETS
// ---------------------------------------------------------------------------

export interface OwnerProofChallenge {
  challengeId: string;
  message: string;
  expiresAt?: string;
}

export async function createOwnerProofChallenge(
  userId: string,
  currency: string,
  userOwnerAddress: string
): Promise<OwnerProofChallenge> {
  const res = await post<any>(
    `/v1/users/${userId}/smart-wallets/owner-proof-challenges`,
    { currency, userOwnerAddress }
  );
  const data = res.data ?? res;
  return {
    challengeId: data.challengeId ?? data.id,
    message: data.message,
    expiresAt: data.expiresAt,
  };
}

export interface CreateManagedWalletInput {
  currency: string; // e.g. "CNGN"
  userOwnerAddress: string;
  ownerProofChallengeId: string;
  ownerProofSignature: string; // EIP-191 signature of challenge.message
}

export interface SmartWallet {
  smartWalletId: string;
  address: string;
  currency: string;
  status: string;
}

export async function createManagedWallet(
  userId: string,
  input: CreateManagedWalletInput
): Promise<SmartWallet> {
  const res = await post<any>(
    `/v1/users/${userId}/smart-wallets/create-managed`,
    input
  );
  const data = res.data ?? res;
  return {
    smartWalletId: data.smartWalletId ?? data.id,
    address: data.address ?? data.walletAddress,
    currency: data.currency ?? input.currency,
    status: data.status ?? "ACTIVE",
  };
}

export async function listWallets(userId: string): Promise<any[]> {
  const res: any = await get<any>(
    `/v1/users/${userId}/smart-wallets/account/wallets`
  );
  if (Array.isArray(res)) return res;
  return res.wallets ?? res.data ?? [];
}

export async function getWalletBalances(
  userId: string,
  smartWalletId: string
): Promise<any> {
  return get(`/v1/users/${userId}/smart-wallets/${smartWalletId}/balances`);
}

/** Account-level balances across all the user's wallets. */
export async function getAccountBalances(userId: string): Promise<any> {
  return get(`/v1/users/${userId}/smart-wallets/account/balances`);
}

/** Transaction history for a wallet. */
export async function listWalletTransactions(
  userId: string,
  smartWalletId: string
): Promise<any[]> {
  const res = await get<any>(
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/transactions`
  );
  return res.transactions ?? res.data ?? res;
}

// ---------------------------------------------------------------------------
// 4. ONBOARDING (Nigeria)
// ---------------------------------------------------------------------------

export async function startNigeriaOnboarding(
  userId: string,
  input: { bvn: string; ngnWalletAddress: string; ngnWalletIndex: number }
): Promise<any> {
  return post(`/v1/users/${userId}/onboarding/start-nigeria`, input);
}

export interface OnboardingStatus {
  // Rails map, e.g. { anchorStatus, bridgeStatus, moneriumStatus, paytrieStatus, etherfuseStatus }
  [rail: string]: any;
}

export async function getOnboardingStatus(
  userId: string
): Promise<OnboardingStatus> {
  return get(`/v1/users/${userId}/onboarding/status`);
}

/**
 * Onboarding status is a rails map:
 *   anchorStatus    — the NGN anchor (Nigeria)
 *   bridgeStatus    — USD bridge
 *   moneriumStatus  — EU (SEPA)
 *   etherfuseStatus — MX
 *   paytrieStatus   — CAD
 * Poll until the target rail is active/failed or timeout.
 */
export async function waitForOnboarding(
  userId: string,
  opts: {
    rail?: string; // default "anchorStatus"
    timeoutMs?: number;
    intervalMs?: number;
    onTick?: (s: any) => void;
  } = {}
): Promise<OnboardingStatus> {
  const rail = opts.rail ?? "anchorStatus";
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 5_000;
  const start = Date.now();
  let last: OnboardingStatus = {};
  while (Date.now() - start < timeoutMs) {
    last = await getOnboardingStatus(userId);
    opts.onTick?.(last);
    const s = String(last[rail] ?? "").toUpperCase();
    if (s.includes("ACTIVE") || s.includes("COMPLETED")) return last;
    if (s.includes("FAIL") || s.includes("REJECT")) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

export function railStatus(status: OnboardingStatus, rail = "anchorStatus"): string {
  return String(status[rail] ?? "unknown");
}

// ---------------------------------------------------------------------------
// 5. TRANSFERS & SWAPS (proposal → approve → sign)
// ---------------------------------------------------------------------------

export interface ProposalResponse {
  proposalId: string;
  status: string;
  [k: string]: any;
}

export async function createTransferProposal(
  userId: string,
  smartWalletId: string,
  input: {
    toAddress?: string;
    toUserId?: string;
    amount: string; // decimal string
    currency: string; // token code, e.g. "CNGN"
    description?: string;
  }
): Promise<ProposalResponse> {
  const res = await post<any>(
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/proposals`,
    {
      proposal: {
        type: "TRANSFER",
        toAddress: input.toAddress,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
    }
  );
  const data = res.data?.proposal ?? res.proposal ?? res.data ?? res;
  return {
    proposalId: data.id ?? data.proposalId,
    status: data.status ?? "PENDING_APPROVALS",
    ...data,
  };
}

export async function createSwapProposal(
  userId: string,
  smartWalletId: string,
  input: {
    fromStablecoin: string;
    toStablecoin: string;
    fromAmount: string;
    slippageBps?: number;
  }
): Promise<ProposalResponse> {
  const res = await post<any>(
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/proposals`,
    {
      proposal: {
        type: "SWAP",
        fromStablecoin: input.fromStablecoin,
        toStablecoin: input.toStablecoin,
        fromAmount: input.fromAmount,
        slippageBps: input.slippageBps ?? 50,
      },
    }
  );
  const data = res.data?.proposal ?? res.proposal ?? res.data ?? res;
  return {
    proposalId: data.id ?? data.proposalId,
    status: data.status ?? "PENDING_APPROVALS",
    ...data,
  };
}

export async function approveProposal(
  userId: string,
  proposalId: string
): Promise<any> {
  return post(`/v1/users/${userId}/smart-wallets/proposals/${proposalId}/approve`);
}

export interface SignPayload {
  hashToSign: string; // raw 32-byte digest — sign WITHOUT EIP-191 prefix
  deadline?: string;
  safeTxHash?: string;
  userOpHash?: string;
  typedData?: any;
}

export async function getSignPayload(
  userId: string,
  proposalId: string
): Promise<SignPayload | null> {
  try {
    const res = await get<any>(
      `/v1/users/${userId}/smart-wallets/proposals/${proposalId}/sign-payload`
    );
    const data = res.data ?? res;
    // Actual response: { signingPayloadHash, typedData, proposalStatus }
    if (!data.signingPayloadHash && !data.hashToSign) return null;
    return {
      hashToSign: data.signingPayloadHash ?? data.hashToSign,
      deadline: data.signatureExpiresAt ?? data.deadline,
      safeTxHash: data.safeTxHash,
      userOpHash: data.userOpHash,
      typedData: data.typedData,
    };
  } catch {
    // 404 while still PENDING_APPROVALS — poll instead
    return null;
  }
}

export async function submitProposalSignature(
  userId: string,
  proposalId: string,
  signature: string
): Promise<any> {
  return post(`/v1/users/${userId}/smart-wallets/proposals/${proposalId}/sign`, {
    signature,
  });
}

export async function getProposal(
  userId: string,
  proposalId: string
): Promise<any> {
  const res = await get<any>(
    `/v1/users/${userId}/smart-wallets/proposals/${proposalId}`
  );
  // Response shape: { proposal: {...} }
  return res.proposal ?? res.data ?? res;
}

export async function rejectProposal(
  userId: string,
  proposalId: string,
  reason?: string
): Promise<any> {
  return post(`/v1/users/${userId}/smart-wallets/proposals/${proposalId}/reject`, {
    reason,
  });
}

export async function listProposals(
  userId: string,
  smartWalletId: string
): Promise<any[]> {
  const res = await get<any>(
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/proposals`
  );
  return res.proposals ?? res.data ?? [];
}

/**
 * Full transfer lifecycle helper:
 *   proposal → approve → (poll sign-payload) → sign → poll terminal status.
 *
 * signRawHash must sign a RAW 32-byte digest (ethers: signingKey.sign(h).serialized)
 * NOT a message (no EIP-191 prefix).
 */
export async function executeTransfer(opts: {
  userId: string;
  smartWalletId: string;
  toAddress?: string;
  toUserId?: string;
  amount: string;
  currency: string;
  description?: string;
  signRawHash: (hashToSign: string) => Promise<string>;
  signTypedData?: (typedData: any) => Promise<string>;
  onStatus?: (status: string) => void;
}): Promise<{ proposalId: string; status: string }> {
  const { onStatus } = opts;
  onStatus?.("CREATING_PROPOSAL");
  const proposal = await createTransferProposal(
    opts.userId,
    opts.smartWalletId,
    {
      toAddress: opts.toAddress,
      toUserId: opts.toUserId,
      amount: opts.amount,
      currency: opts.currency,
      description: opts.description,
    }
  );

  onStatus?.("APPROVING");
  await approveProposal(opts.userId, proposal.proposalId);

  onStatus?.("WAITING_FOR_SIGNING");
  let payload: SignPayload | null = null;
  const deadline = Date.now() + 60_000;
  while (!payload && Date.now() < deadline) {
    payload = await getSignPayload(opts.userId, proposal.proposalId);
    if (!payload) await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!payload) {
    throw new BmoniError("sign-payload never became available", 504, "SIGN_TIMEOUT");
  }

  onStatus?.("SIGNING");
  // NOTE: the API accepts the RAW-digest ECDSA signature over signingPayloadHash.
  // (EIP-712 typed-data signatures are rejected — verified against the sandbox.)
  const signature = await opts.signRawHash(payload.hashToSign);
  await submitProposalSignature(opts.userId, proposal.proposalId, signature);

  onStatus?.("SUBMITTED");
  let status = "PENDING_SIGNATURES";
  const settleDeadline = Date.now() + 120_000;
  while (Date.now() < settleDeadline) {
    const p = await getProposal(opts.userId, proposal.proposalId);
    status = String(p.status ?? p.data?.status ?? "").toUpperCase();
    onStatus?.(status);
    if (status === "COMPLETED" || status === "FAILED" || status === "REJECTED")
      break;
    await new Promise((r) => setTimeout(r, 3_000));
  }

  return { proposalId: proposal.proposalId, status };
}

// ---------------------------------------------------------------------------
// 6. NGN BANK WITHDRAWALS (verify → register → offramp)
// ---------------------------------------------------------------------------

export async function listNigerianBanks(userId: string): Promise<any[]> {
  const res = await get<any>(`/v1/users/${userId}/bank-accounts/nigerian-banks`);
  return res.banks ?? res.data ?? res;
}

export async function verifyNigerianAccount(
  userId: string,
  accountNumber: string,
  bankCode: string
): Promise<{ accountHolderName: string; [k: string]: any }> {
  const res = await post<any>(
    `/v1/users/${userId}/bank-accounts/verify-nigerian-account`,
    { accountNumber, bankCode }
  );
  const data = res.data ?? res;
  return {
    accountHolderName: data.accountHolderName ?? data.accountName,
    ...data,
  };
}

export async function registerWithdrawalAccount(
  userId: string,
  input: {
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountHolderName: string;
  }
): Promise<{ bankAccountId: string; [k: string]: any }> {
  const res = await post<any>(
    `/v1/users/${userId}/bank-accounts/withdrawal-accounts/nigeria`,
    input
  );
  const data = res.data ?? res;
  return {
    bankAccountId: data.id ?? data.bankAccountId,
    ...data,
  };
}

export async function listWithdrawalAccounts(userId: string): Promise<any[]> {
  const res = await get<any>(
    `/v1/users/${userId}/bank-accounts/withdrawal-accounts/nigeria`
  );
  return res.accounts ?? res.data ?? res;
}

export async function createNigeriaOfframp(
  userId: string,
  smartWalletId: string,
  input: { bankAccountId: string; fromAmount: string }
): Promise<ProposalResponse> {
  const res = await post<any>(
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/offramp/nigeria`,
    input
  );
  const data = res.data ?? res;
  return {
    proposalId: data.proposalId ?? data.id,
    status: data.status ?? "PENDING_APPROVALS",
    quote: data.quote,
  };
}

/**
 * Full NGN withdrawal helper: offramp proposal → approve → sign → terminal status.
 */
export async function executeNgnWithdrawal(opts: {
  userId: string;
  smartWalletId: string;
  bankAccountId: string;
  fromAmount: string;
  signRawHash: (hashToSign: string) => Promise<string>;
  signTypedData?: (typedData: any) => Promise<string>;
  onStatus?: (status: string) => void;
}): Promise<{ proposalId: string; status: string }> {
  const { onStatus } = opts;
  onStatus?.("CREATING_OFFRAMP");
  const proposal = await createNigeriaOfframp(
    opts.userId,
    opts.smartWalletId,
    { bankAccountId: opts.bankAccountId, fromAmount: opts.fromAmount }
  );

  onStatus?.("APPROVING");
  await approveProposal(opts.userId, proposal.proposalId);

  onStatus?.("WAITING_FOR_SIGNING");
  let payload: SignPayload | null = null;
  const deadline = Date.now() + 60_000;
  while (!payload && Date.now() < deadline) {
    payload = await getSignPayload(opts.userId, proposal.proposalId);
    if (!payload) await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!payload) {
    throw new BmoniError("sign-payload unavailable", 504, "SIGN_TIMEOUT");
  }

  onStatus?.("SIGNING");
  // NOTE: the API accepts the RAW-digest ECDSA signature over signingPayloadHash.
  // (EIP-712 typed-data signatures are rejected — verified against the sandbox.)
  const signature = await opts.signRawHash(payload.hashToSign);
  await submitProposalSignature(opts.userId, proposal.proposalId, signature);

  onStatus?.("SUBMITTED");
  let status = "PENDING_SIGNATURES";
  const settleDeadline = Date.now() + 180_000;
  while (Date.now() < settleDeadline) {
    const p = await getProposal(opts.userId, proposal.proposalId);
    status = String(p.status ?? p.data?.status ?? "").toUpperCase();
    onStatus?.(status);
    if (status === "COMPLETED" || status === "FAILED" || status === "REJECTED")
      break;
    await new Promise((r) => setTimeout(r, 4_000));
  }

  return { proposalId: proposal.proposalId, status };
}

// ---------------------------------------------------------------------------
// 7. DEPOSITS (virtual bank account)
// ---------------------------------------------------------------------------

/** Nigerian virtual bank account(s) for deposits. */
export async function getDepositAccounts(userId: string): Promise<any[]> {
  const res: any = await get<any>(
    `/v1/users/${userId}/bank-accounts/deposit-accounts/NGN`
  );
  if (Array.isArray(res)) return res;
  return res.accounts ?? res.data ?? [];
}

// ---------------------------------------------------------------------------
// 8. EXCHANGE (quote → convert)
// ---------------------------------------------------------------------------

export async function getExchangeQuote(
  userId: string,
  input: { from: string; to: string; amount: string }
): Promise<any> {
  return post(`/v1/users/${userId}/exchange/quote`, input);
}
