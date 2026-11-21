# Test plan

| Layer | Tool | Command | Network |
|---|---|---|---|
| Unit | Vitest + jsdom | `npm run test` | none |
| Integration (adapter with a fake SDK, DemoWallet, rendered pages) | Vitest + Testing Library | `npm run test` | none |
| E2E (Demo journey, Lab, i18n, 360 px) | Playwright, production build (CSP on) | `npm run test:e2e` | none: fails if Demo touches `2nd.dev` |
| E2E (live Signet) | Playwright | `LIVE_SIGNET=1 npm run test:e2e -- --project=desktop signet` | Second's Signet server; opt-in |

## Acceptance tests (spec §12) → where they are covered

| ID | Covered by |
|---|---|
| T01 start without a wallet → demo, no real balance | `e2e/demo.spec.ts` (journey starts at Welcome; balance only after "start demo") |
| T02 create Signet wallet client-side | `e2e/signet.spec.ts` (live) |
| T03 demo never mixes with real data | separate `DemoWallet` / `walletId`; `compareSnapshots` refuses cross-wallet diffs (`unit/snapshots`) |
| T04 SDK spendable shown | `unit/normalize`, `integration/adapter` |
| T05 pending/needs-refresh not added to spendable | same; mutation-tested |
| T06 Signet address + QR | `e2e/signet.spec.ts` (`tark1p…`); QR rendered on Receive |
| T07 mainnet destination refused | `integration/adapter` + live probe (`validateArkoorAddress` → false; SDK send throws) |
| T08 explicit confirmation, history on success | `integration/ui` (no send until confirm), `integration/adapter` (movement id) |
| T09 connection lost mid-send → unknown, no retry | `integration/adapter` |
| T10 VTXO detail shows only evidenced fields | `unit/normalize` (missing → undefined, evidence attached) |
| T11 expiry only, no tip → no fabricated remaining blocks | `unit/expiry`, `integration/adapter` (no on-chain wallet) |
| T12 diff of real VTXOs only | `unit/snapshots`, `e2e/demo.spec.ts` |
| T13 VTXO list unsupported → concept view | `integration/adapter`, `integration/ui` |
| T14 Lab slider never touches the wallet | `unit/lessons` (imports), `integration/ui` (spies), `e2e/demo.spec.ts` |
| T15 offboard vs emergency exit explained | `unit/lessons`, `e2e/demo.spec.ts` (Lesson 5) |
| T16 seed-only restore limits | `unit/lessons` (Lesson 6 model); UI copy in create/restore/settings |
| T17 no storage → stop real wallet creation | `security/environment.ts` gates the create/restore buttons (manual check) |
| T18 mainnet config refused | `unit/signet-guard` + real `vite build` with mainnet env |
| T19 360 px usable | `e2e/demo.spec.ts` runs at 360 px; no horizontal overflow on main pages |
| T20 logs contain no secrets | `unit/redact`, live E2E console assertion |
| T21 pay button mashing → one request | `integration/adapter`, `integration/demo-wallet`, `integration/ui`; mutation-tested |
| T22 SDK type change detected | `WalletLike = Pick<Wallet, …>` fails `npm run typecheck` |

## Not yet verified (needs Signet funds; the faucet requires a GitHub login)

- Receiving real sats and seeing them as VTXOs.
- A real `sendArkoorPayment` and its before/after diff.
- Restore of a funded wallet (mailbox recovery).
- VTXO expiry → `needs-refresh` on the real server.
