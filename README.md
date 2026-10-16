# SharpSharp ⚡

**Diaspora money that lands instantly.**

SharpSharp is a remittance experience built on [BMONI Embedded](https://embedded-dev.bmoni.com) for the Learn2Earn hackathon. A parent abroad tops up, a student in Nigeria receives cNGN in seconds — and can withdraw to any Nigerian bank account, all through one conversational interface.

## The demo cast

| Persona | Story |
| --- | --- |
| **Samson Jabo** (parent) | Works abroad, funds the wallet, sends money home |
| **Bunch Dillon** (student) | In Lagos, receives instantly, withdraws to a bank account |

Both personas are fully onboarded in the BMONI sandbox: KYC verified, smart wallets provisioned, NGN rails **active**, and real Nigerian virtual NUBANs issued (Providus Bank).

## Architecture

```
Next.js 14 (App Router) + TypeScript + Tailwind
│
├── lib/bmoni.ts      — full BMONI Embedded client (21 endpoints)
│     user → KYC → wallet → rail → proposals → sign → offramp
├── lib/keystore.ts   — demo persona key management (EIP-191 + raw-digest signing)
├── app/api/*         — server routes that drive the full lifecycle
├── app/dashboard    — live wallet, balances, VBA details, onboarding states
├── app/onboarding   — 6-stage lifecycle wizard with live sandbox status
├── app/concierge    — conversational money movement ("send 5k naira to my student")
└── middleware.ts    — security headers on every response (X-Frame-Options,
      X-Content-Type-Options, Referrer-Policy)
```

### The transfer pipeline (proven end-to-end against the sandbox)

```
create proposal → approve → fetch sign-payload → sign (raw-digest ECDSA)
→ submit signature → relay executes on-chain (Base Sepolia, chain 84532)
```

> Verified finding: the API accepts the **raw-digest** signature over
> `signingPayloadHash` — EIP-712 typed-data signatures are rejected.

## API routes

| Route | What it does |
| --- | --- |
| `POST /api/onboard` | Runs persona onboarding (BVN → KYC → wallet → NGN rail) |
| `GET /api/demo` | Live sandbox state: wallets, balances, virtual NUBANs |
| `GET /api/banks` | All 302 CBN-registered Nigerian banks |
| `POST /api/transfer` | Parent → student transfer with full proposal/sign flow |
| `POST /api/withdraw` | Verify → register → offramp proposal → sign → settle |
| `POST /api/concierge` | Natural-language money commands with real execution |

## Getting started

```bash
npm install
cp .env.example .env.local   # add your BMONI sandbox API key
npm run seed                  # create + onboard both personas (~2 min)
npm run dev
```

## Sandbox status (2026-09-03)

- ✅ Two personas fully KYC'd, wallets provisioned, NGN rails **active**
- ✅ Real virtual NUBANs issued (deposits land straight in the smart wallet)
- ✅ Transfer pipeline proven end-to-end (executes; awaits sandbox test-token credit for funds)
- ✅ Withdrawal verify → register → offramp flow working
- ⏳ Sandbox test tokens: request at bkey.mintlify.app/request-test-tokens
  (phone numbers in `demo-state.json`, which `npm run seed` generates locally
  — the file is gitignored, so it exists only after seeding)

## Demo script (2 minutes)

1. **Landing** — the pitch: instant diaspora-to-Nigeria remittances
2. **Dashboard** — live sandbox state: active rails, real Providus Bank NUBANs
3. **Transfer** — Samson sends ₦25 to Dillon; proposal → approve → sign → execute
4. **Concierge** — type "what is my balance" and "send 50 naira to my student"
5. **Withdraw** — Dillon cashes out to a Nigerian bank account (verify → offramp)
