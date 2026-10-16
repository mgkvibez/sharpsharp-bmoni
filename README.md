# SharpSharp ⚡

**Diaspora money that lands instantly.**

SharpSharp is a remittance experience built on [BMONI Embedded](https://embedded-dev.bmoni.com) for the Learn2Earn hackathon. A parent abroad tops up, a student in Nigeria receives cNGN in seconds — and can withdraw to any Nigerian bank account, all through one conversational interface.

## Contents

- [The demo cast](#the-demo-cast)
- [Architecture](#architecture)
- [API routes](#api-routes)
- [Getting started](#getting-started)
- [Sandbox status](#sandbox-status-2026-09-03)
- [Demo script](#demo-script-2-minutes)
- [Tech stack](#tech-stack)
- [Utility scripts](#utility-scripts)
- [Demo runbook](#demo-runbook)
- [Security](#security)
- [Notes on the sandbox snapshot](#notes-on-the-sandbox-snapshot)
- [License](#license)

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


## Tech stack

- [Next.js 14](https://nextjs.org) (App Router) + TypeScript, Tailwind CSS for the UI
- [ethers v6](https://docs.ethers.org) for ECDSA signing (raw-digest signatures over `signingPayloadHash`)
- [tsx](https://tsx.is) for the local utility scripts in `scripts/`
- [BMONI Embedded](https://embedded-dev.bmoni.com) sandbox for KYC, wallets, NGN rails and on-chain relay (Base Sepolia, chain 84532)

## Utility scripts

These live in `scripts/` and are run with `npx tsx scripts/<name>.ts`:

| Script | What it does |
| --- | --- |
| `seed.ts` | Takes both sandbox personas from nothing to fully-onboarded NGN users with active CNGN smart wallets |
| `complete-user.ts` | Completes the lifecycle for an existing KYC-complete user: owner-proof challenge → managed wallet → Nigeria onboarding |
| `rebuild-parent.ts` | Rebuilds the parent persona end-to-end with a persisted owner key (a user can hold only one wallet per currency) |
| `fix-parent-wallet.ts` | Recovery path for the orphaned parent wallet after a seed crash: mints a fresh wallet with a persisted key |
| `upload-parent-docs.ts` | Uploads the parent's KYC documents (deflate + CRC32 packaging) |
| `sign-and-submit.ts` | Manual signing harness for a proposal: fetches the sign payload, prints the hash, and demonstrates both signature formats |
| `check-sig.ts` | Local sanity check for the parent's owner key |

## Demo runbook

A step-by-step 2-minute demo script with a pre-demo checklist lives in
[DEMO.md](DEMO.md) — use it alongside the demo flow below.

## Security

- `middleware.ts` sets baseline security headers on every response:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- The BMONI API key (`BMONI_API_KEY`) is only ever read on the server —
  all BMONI calls go through `app/api/*` routes, never from the browser.
- Demo persona owner keys are held locally by `lib/keystore.ts` and are
  never committed (`demo-state.json` is gitignored).

## Notes on the sandbox snapshot

The "Sandbox status" section above is the verification snapshot taken for
the hackathon submission (2026-09-03). Re-verify against the current BMONI
sandbox before relying on any specific endpoint behaviour.

## License

[MIT](LICENSE) — Copyright (c) 2026 Michael Oogwu.
