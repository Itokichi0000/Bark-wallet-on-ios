# SDK capabilities — `@secondts/bark` (Web / WASM)

Checked 2026-11-21. Sources, in order of authority:

1. The **installed** type definitions: `node_modules/@secondts/bark/web/bark_ffi_wasm.d.ts`.
2. A **live probe** against Second's Signet Ark server from headless Chromium (results below).
3. Official docs: [WebAssembly SDK](https://second.tech/docs/bark-sdk/wasm), [Connection details](https://second.tech/docs/connection-details), [Backups](https://second.tech/docs/backups), [Changelog](https://second.tech/docs/changelog).

Barkd REST endpoints were **not** used as evidence for anything in the browser SDK.

## Package

| | |
|---|---|
| Package | `@secondts/bark` (official, published by Second's GitLab CI via npm trusted publishing) |
| Version used | **0.28.0**, pinned exactly (`releaseTag v0.28.0+bark-0.9.0`, published 2026-11-19) |
| Entry point | `@secondts/bark/web` + `@secondts/bark/web/bark_ffi_wasm_bg.wasm?url` (Vite) |
| WASM size | 7.9 MB (4.4 MB gzip), loaded lazily — Demo mode never downloads it |
| Requirements | WebAssembly, IndexedDB, Web Locks, secure context (HTTPS or `localhost`). Node.js is not supported |
| Amounts | `number` (sats). The app asserts safe integers at the boundary (`lib/wallet/sats.ts`) |
| Not used | `@arkade-os/sdk` or any other Ark implementation |

0.27.0 → 0.28.0 changed board, recovery and CPFP-fee types only. Every method this app calls has the same signature in both. Bark 0.9.0's changelog notes that **wallets on Bark 0.8.1 or older can fail payments from small VTXOs** against an upgraded server, so 0.28.0 is the right pin.

## Signet configuration (verified)

```ts
Wallet.openWithOnchain('Signet', mnemonic,
  { serverAddress: 'https://ark.signet.2nd.dev', esploraAddress: 'https://esplora.signet.2nd.dev', userAgent: 'ark-school-wallet/0.1.0' },
  onchain, { indexedDbName, runDaemon: false, createIfNotExists })
```

- `network` is a positional argument (`"Signet"`), not a config field.
- **`userAgent` must contain a slash** (`name/version`). Without one the server rejects the handshake: `invalid x-user-agent: no slash present`. Found during the live spike.
- `esploraAddress` is required; the WASM SDK supports Esplora only.

### Live values from Second's Signet server (2026-11-21)

| Field | Value | Note |
|---|---|---|
| `arkInfo().network` | `Signet` | Checked at runtime; anything else aborts the open |
| `vtxoLifetime` | **144 blocks** (~1 day) | Much shorter than the 28 days documented for mainnet |
| `config().vtxoRefreshExpiryThreshold` | 12 blocks | Bark's own refresh threshold |
| `vtxoExitDelta` | 12 | |
| `maxVtxoExitDepth` | 100 | |
| `roundIntervalSecs` | 300 | |
| `minBoardAmountSats` | 10,000 | |
| `feeSchedule.refresh.ppmExpiryTable` | 0 / 2000 / 4000 / 5000 ppm at 0 / 288 / 1008 / 2016 blocks | Read-only; shown via `estimateRefreshFee` |
| `config().boardLifetime` | 4320 | |
| `OnchainWallet.tipHeight()` | 331,799 at probe time | |
| `newAddress()` prefix | `tark1p…` | |

## Capability table

Status = what **this app** does. "disabled" = present in the SDK, deliberately not executed.

| Feature | SDK API (TypeScript signature) | Status in app | Evidence |
|---|---|---|---|
| Create / open | `Wallet.open(network, mnemonic, config, onchain?, OpenWalletArgs)`, `Wallet.openWithOnchain(...)` | ✅ supported | Live E2E: create, reload, unlock |
| Restore | Same call with `createIfNotExists: true` on a fresh `indexedDbName`; `recoveryStatus()`, `pendingRecovery()` | ✅ supported (no funded restore tested) | `recoveryStatus()` = `completed` for a fresh wallet |
| Mnemonic | `generateMnemonic(): string`, `validateMnemonic(m): boolean` | ✅ | |
| Balance | `balance(): Promise<Balance>` (9 categories), `balanceSummary(): Promise<BalanceSummary>` | ✅ | Probe returned all categories |
| Ark address | `newAddress(): Promise<string>` | ✅ | `tark1p…` |
| Address check | `validateArkAddress(a): boolean` (format only), `wallet.validateArkoorAddress(a): Promise<boolean>` (network + server), `parsePaymentRequest(a)` | ✅ | Mainnet `ark1…` re-encoding: format check `true`, `validateArkoorAddress` `false` |
| Ark send | `sendArkoorPayment(address, amountSats): Promise<number /* movementId */>` | ✅ supported, **not exercised with funds** | Mainnet address throws `Ark address is for different network` |
| Send fee | `estimateArkoorPaymentFee(amountSats): Promise<FeeEstimate>` (includes `vtxosSpent`) | ✅ | |
| Sync | `sync(): Promise<void>`, `OnchainWallet.sync()` | ✅ | Daemon off; app syncs every 30 s + on demand |
| VTXO list | `allVtxos()`, `vtxos()`, `spendableVtxos()`, `getVtxoById(id)` → `Vtxo` | ✅ | Empty list for a fresh wallet |
| VTXO fields | `Vtxo { id, amountSats, expiryHeight, kind, state: VtxoState, exitDepth, exitTxWeightWu, registered }` | ✅ all shown | |
| VTXO state | `VtxoState = spendable | locked{holder} | spent | exited` | ✅ mapped 1:1 | |
| Needs refresh | `getVtxosToRefresh()`, `Balance.needsRefreshSats`, `getNextRequiredRefreshBlockheight()` | ✅ (per VTXO from `getVtxosToRefresh`) | |
| Pending | `pendingRoundInputVtxos()`, `pendingBoardVtxos()`, `pendingLightningSendVtxos()`, `pendingRoundStates()` | ✅ used to mark `pending` | |
| Chain tip | **Only** `OnchainWallet.tipHeight()` (the `Wallet` class has no tip method) | ✅ via an on-chain wallet opened alongside | Without it, blocks-remaining is shown as unavailable |
| History | `history(): Promise<Movement[]>` with `inputVtxoIds` / `outputVtxoIds` / `exitedVtxoIds` | ✅ (Life tab, diff evidence, reconciliation) | |
| Server info | `arkInfo(): Promise<ArkInfo | undefined>` | ✅ | |
| Refresh | `refreshVtxos(ids)`, `refreshVtxosDelegated(ids)`, `refreshVtxosScheduled(ids, h)`, `maintenanceRefresh()` | ◐ **disabled** | Not verified on Signet (needs funds); `estimateRefreshFee(ids)` read-only is enabled |
| Offboard | `offboardAll(addr)`, `offboardVtxos(ids, addr)`, `estimateOffboardFee(...)` | ◐ disabled (education only) | Out of MVP scope |
| Emergency exit, execute | `startExitForVtxos(ids)`, `startExitForEntireWallet()`, `progressExits()`, `drainExits()`, `cancelExit()` | ◐ disabled | Spec: MVP is explanation/simulation only |
| Exit estimate | `estimateEmergencyExitFee(ids, feeRate?, dest?, margin?)` | ✅ read-only | Probe: 0 for an empty wallet |
| Exit transactions | `remainingExitTransactions({ vtxoIds })` → txids in broadcast order | ✅ read-only | Shown on VTXO detail. This is the only real exit-chain data drawn; the tree diagram stays conceptual |
| Exit status | `getExitStatus(...)`, `listLiveExits(...)`, `getExitVtxos()` | ◐ disabled (no exits are ever started) | |
| Full VTXO serialization | `vtxoEncoded(id)` (genesis chain hex) | not used | Future: read-only structure view, parsed locally, never uploaded |
| Lightning / on-chain send | `sendPayment`, `payLightningInvoice`, `sendOnchain`, … | not used | P1 |
| DB backup / export | — | ✗ **unsupported** | No consistent DB snapshot/export/import API in the WASM SDK |
| Logging | `setLogger(logger, level)` | ✅ routed into the redacted in-memory buffer | |

## Gaps and differences found

- **The docs' example vs. this app:** the docs keep the mnemonic in `localStorage` ("Signet tests only"). This app encrypts it with a passphrase instead (see `SECURITY_REVIEW.md`).
- **No chain-tip method on `Wallet`.** An `OnchainWallet` is opened next to it just to get `tipHeight()` and the on-chain balance.
- **Background daemon:** `Wallet.open` starts it by default, and its maintenance can refresh VTXOs on its own. The app passes `runDaemon: false` to satisfy "no automatic refresh". **Consequence on Signet:** with a 144-block lifetime, received VTXOs become "needs refresh" after about a day unless refreshed elsewhere. The UI says so.
- **`validateArkAddress` is a format check only.** It accepts mainnet `ark1…` addresses. The network/server check is `wallet.validateArkoorAddress`.
- **No continuous DB backup.** IndexedDB holds everything, and the SDK exposes no consistent export. Seed-only restore depends on the server's mailbox.
- **SDK type changes (T22):** `WalletLike = Pick<Wallet, …>` in `src/lib/bark/adapter.ts` fails `npm run typecheck` if any method the adapter uses disappears or changes shape on an SDK upgrade.
