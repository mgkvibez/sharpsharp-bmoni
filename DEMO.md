# SharpSharp — Demo Runbook (2 minutes)

**Setup before the demo:**
- [ ] Request sandbox test tokens: https://bkey.mintlify.app/request-test-tokens
      (submit BOTH phone numbers from demo-state.json — credited within the hour)
- [ ] `npm run build && npm run start` — confirm dashboard loads
- [ ] Have a real Nigerian bank account number ready for the withdrawal step
      (sandbox verification only resolves real accounts)

---

## 0. The hook (15s)

"One billion dollars a year leaves Nigeria's diaspora. SharpSharp puts it in the
student's wallet in one block confirmation — not three business days."

## 1. Landing page (15s)

- Instant cNGN transfer, no correspondent banks, no float
- Point at the "how it works" strip: top-up → cNGN → instant arrival

## 2. Dashboard — live state (30s)

- Two personas: Samson Jabo (parent) and Bunch Dillon (student)
- **Both rails say ACTIVE — this is live BMONI sandbox state, not mock data**
- Show the virtual NUBANs: real Providus Bank accounts (9684280202 / 8153233273)
- A bank transfer into that NUBAN lands straight in the smart wallet

## 3. The transfer — the money shot (30s)

- Post to /api/transfer (or use the concierge page)
- Narrate the pipeline as events tick:
  `CREATING_PROPOSAL → APPROVING → SIGNING → SUBMITTED → COMPLETED`
- "Every naira moves as a proposal that the wallet owner signs — that's the
  security model: the key never leaves the owner."

## 4. Concierge (20s)

- Type: "what is my balance" → real wallet balance
- Type: "send 50 naira to my student" → executes a real transfer
- "No forms, no app navigation. Money moves at the speed of speech."

## 5. Withdrawal — closing the loop (15s)

- Withdraw to any Nigerian bank: verify → register → offramp → sign
- "Dillon's landlord doesn't care about stablecoins — this is naira in a
  normal bank account."

## 6. Close (5s)

"Wallets, KYC, rails, rails, signing, settlement — all of it is BMONI Embedded.
We just made it feel like texting."
