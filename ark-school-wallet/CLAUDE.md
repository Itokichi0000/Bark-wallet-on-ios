# Ark School Wallet — Claude Code Rules

## Start here

Read `docs/SPEC.md` completely before writing code. This is an **educational Signet-only Bark wallet** with three experiences: Wallet, X-Ray, Lab. The product must illustrate actual VTXO states and Ark concepts without confusing sample values with real chain/wallet data.

## Inviolable constraints

1. Use the **official `@secondts/bark` WebAssembly SDK**. Do not replace it with Arkade or another Ark SDK.
2. **Signet ONLY.** Do not implement mainnet options. Validate network at configuration, address handling, and UI.
3. Never ask users to paste a mnemonic into any server/API. Never log or send mnemonics, wallet DB contents, private keys, or seed-derived materials to telemetry.
4. Wallet keys must stay client-side. Bark storage uses IndexedDB; model data eviction, XSS, and incomplete backups as real risks.
5. Seed-only backup depends on server cooperation and does not fully restore history/in-progress exits. Do not claim seed is a complete backup. A proper encrypted continuously updated DB backup needs its own design and tests.
6. Distinguish `DEMO` versus `LIVE` on every screen. DemoWallet is isolated and must **never** initiate a network payment.
7. `WalletPort` in SPEC is an **app-defined interface**, not actual Bark SDK API. Verify installed package `.d.ts` and official docs before writing the adapter.
8. Do not infer Web SDK support from Barkd REST endpoints. Unsupported operations must be disabled and clearly explained.
9. Never display fabricated VTXO details, on-chain transaction graphs, fee estimates, exit status, or block heights as actual data.
10. Sending bitcoin must require explicit user confirmation; never auto-retry an uncertain payment.
11. No automatic refresh, offboard, or emergency exit without explicit and documented safeguards. MVP requires only educational simulation of exit.
12. Show data source / last sync time / unknown fields as appropriate. Use integer-safe sat amounts.

## Technology defaults

- Vite / React / TypeScript / Tailwind + accessible component library
- `@secondts/bark` for real browser wallet
- Zustand or equivalent small client state; TanStack Query if needed
- X-Ray graphs with SVG or React Flow
- Vitest, Testing Library, Playwright
- bilingual ja/en; Japanese primary

## Mandatory delivery sequence

### Step 0 — research before coding

- `npm` inspect current official package version + package exports + actual type definitions.
- Check official Second SDK docs, connection details, backups and changelog.
- Create `docs/SDK_CAPABILITIES.md`: method names, TypeScript signatures, tested functionality, unavailable features.
- Create `docs/SECURITY_REVIEW.md` including browser key storage and continuous wallet backup feasibility.
- If TypeScript/Web WASM cannot expose VTXO list/detail, do not invent data. Build the Demo X-Ray with a clear SDK limitation note and propose a future safe read-only integration.

### Step 1 — UI & learning lab

- Build functional responsive layout with Wallet / X-Ray / Lab / Learn tabs.
- Add DemoWallet with deterministic fixtures for receive, send, refresh and expiry.
- Build conceptual graph with obvious `DEMO/CONCEPTUAL` label.
- Add localized explanations and 5-6 guided lessons.

### Step 2 — integrate real Signet wallet

- Implement real SDK adapter with currently available API only.
- Create/open/restore wallet, display spendable/needs-refresh/pending categories accurately.
- Generate Ark address and QR; Signet sync, receive, manual small send, transaction history where available.
- Add concurrency and retry safeguards. Verify with a real Signet wallet if access/faucet permits.

### Step 3 — VTXO visualization

- Normalize actual SDK VTXO data where supported.
- Show ID, sats, type/state, expiry height, chain height, remaining blocks, exit depth if available.
- Show before/after transaction snapshot diff. Never substitute illustrative graphs for live outputs.

### Step 4 — safe extensions

- Refresh only if supported and fully tested on Signet.
- Cooperative offboard and emergency exit: educational read-only views first. Execution is explicitly out of MVP scope.
- Backup export/import must be tested for consistent DB snapshots; do not claim fully recoverable otherwise.

## Quality gates

Always run and fix: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Add optional Playwright E2E. Keep a `README.md` with setup and confirmed current status.

## Reporting

After each phase, report:
- Implemented and verified
- Mock/simulated only
- SDK unsupported or unverified
- Security limitations
- Tests run and results

If blocked by SDK incompatibility or missing Signet access, deliver the working Demo Lab and accurate adapter interfaces rather than inventing wallet functionality.
