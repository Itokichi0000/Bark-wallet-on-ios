# Security review — Ark School Wallet

Scope: browser key storage, restore, sending, backup, emergency exit, and Signet lock-in. Status as of 2026-11-21, `@secondts/bark` 0.28.0.
**Verdict:** acceptable as a Signet-only educational wallet. **Not** acceptable for mainnet without the items under "Before any mainnet consideration".

## 1. Network lock-in (Signet only)

| Layer | Control | Test |
|---|---|---|
| Build | `scripts/signet-guard.ts` runs from `vite.config.ts`: fails the build/dev server if `VITE_BARK_NETWORK` ≠ `signet`, or if the Ark/Esplora URL is a known mainnet host (`ark.second.tech`, `mempool.second.tech`, `mempool.space`, `blockstream.info`) or non-HTTPS | `tests/unit/signet-guard.test.ts` (T18), verified with real `vite build` |
| Code | `NETWORK = 'Signet'` constant; no network option exists in UI, config or state | — |
| Runtime | After opening, `wallet.network()` **and** `arkInfo().network` must equal `Signet`, otherwise the wallet is freed and opening aborts | `assertSignet` unit test |
| Addresses | `wallet.validateArkoorAddress` (same network + server) before every send; `parsePaymentRequest` to label network mismatches; the SDK itself also refuses (`Ark address is for different network`) | Adapter tests (T07) + live probe with a mainnet `ark1…` address |
| CSP | `connect-src` only allows `'self'`, the Signet Ark server and Esplora | Built `index.html` |
| Storage | IndexedDB names are `ark-school-signet-<random id>` and `ark-school-vault`; nothing is shared with a mainnet namespace | — |

## 2. Keys and the recovery phrase

- **Generated client-side** by the SDK (`generateMnemonic`) inside the page. Never sent to any server of ours (there is no backend).
- **At rest:** encrypted with AES-GCM-256 under a PBKDF2-SHA256 key (600,000 iterations, 16-byte salt, 12-byte IV) derived from a user passphrase of at least 8 characters. Only ciphertext is stored, in IndexedDB (`ark-school-vault`). The mnemonic is **never** written to `localStorage`, URLs, app state (Zustand), logs or analytics (there are none).
- **In memory:** it exists in local variables during create/restore/unlock and while it is shown. The SDK keeps its own copy inside WASM memory while the wallet is open; nothing can prevent that.
- **Display:** only after an explicit tap ("reveal"), with a screenshot/screen-share warning. The settings "show phrase" needs the passphrase and auto-hides after 60 s. Creation requires typing back 3 random words.
- **Logs:** ESLint `no-console` is an error for app code. Bark's logger is routed into an in-memory ring buffer passed through `redact()` (mnemonic-like word runs, xpub/tpub, WIF, long hex, long base64). The diagnostics export is redacted a second time. Tests: T20 (`tests/unit/redact.test.ts`) and the live E2E, which asserts the phrase never appears in the browser console.

### Residual risks (accepted for Signet, documented in the UI)

- **XSS / compromised page / malicious extension** can read the phrase while the wallet is unlocked, or capture the passphrase. Mitigations: strict CSP with no inline/third-party scripts (`script-src 'self' 'wasm-unsafe-eval'`), no `eval`, `referrer: no-referrer`, React escaping. The one `dangerouslySetInnerHTML` renders an SVG generated locally by `qrcode` from a wallet address. **A Web Worker would not fix this**: the worker's code comes from the same origin.
- **Passphrase strength** is the user's. Offline brute force against a stolen IndexedDB is slowed by PBKDF2, not prevented.
- **`frame-ancestors`** cannot be set from a `<meta>` CSP. Hosts should send `Content-Security-Policy: frame-ancestors 'none'` (and the same policy) as HTTP headers.
- **Supply chain:** the SDK is pinned to an exact version with a lockfile; npm shows trusted publishing from Second's GitLab CI. The WASM is served from our own origin, not a CDN.

## 3. Browser storage and backup

- Bark keeps the whole wallet DB in IndexedDB. **It can be evicted** (clearing site data, storage pressure, Safari's 7-day policy for unvisited sites). After creation the app calls `navigator.storage.persist()` and tells the user whether it was granted.
- **Seed-only restore** (official docs, "Backups") recovers the balance only with the Ark server's cooperation, via the mailbox. It does **not** restore history or in-progress exits. Exited funds also need the DB until they are claimed. The UI says this at creation, at restore, in Settings › Backup, and in Lab Lesson 6.
- **Continuous encrypted DB backup:** **not feasible yet** with the WASM SDK. It has no API for a consistent snapshot or export/import of the IndexedDB state, and a raw IndexedDB dump taken while the wallet runs is not guaranteed to be consistent. The capability is marked `unsupported`. A future design: the SDK exposes a consistent export, the export is encrypted with a mnemonic-derived key (per Second's docs), shipped off-device after every state change, and restore is tested before any claim of full recoverability.
- **Deleting a wallet** requires two steps plus typing the confirmation word, and warns that funds are lost without the written phrase. It removes the vault record and both Bark databases.

## 4. Sending

- **Explicit confirmation:** a review dialog shows network, destination (short/full toggle), amount, SDK fee estimate and the VTXOs expected to be spent, then requires a second click.
- **Exactly once (T21):** `SingleFlight` in the adapter rejects concurrent calls without invoking the SDK, the dialog disables its button, and the page has a `sending` phase guard. Covered by adapter, DemoWallet and UI tests. Mutation-tested: removing the guard fails the tests.
- **Uncertain outcome (T09):** any exception from `sendArkoorPayment` is treated as **unknown**, never as failed and never retried. A pending-send marker (no secrets; amount, destination address, timestamp) is written to `localStorage` **before** the SDK call and updated after it. While it exists, sending is locked and a banner asks the user to sync and check history. `findMatchingMovement` looks for a history entry to the same address created after the attempt. Unlocking requires an explicit acknowledgment.
- **Page closed mid-send:** the marker is still `in-flight` on the next open, which shows the "may still be in progress" message (spec 9.5).
- **Pre-flight checks** never reach the SDK: empty or invalid address, wrong network/server, non-integer or zero amount, amount above spendable.

## 5. Automatic actions

- The Bark background daemon is **off** (`runDaemon: false`). The app only calls `sync()`: manually, and every 30 s while the page is visible. **No automatic refresh, offboard or exit.**
- Trade-off: on Second's Signet server (VTXO lifetime 144 blocks), VTXOs hit "needs refresh" after about a day. The app explains this. Enabling refresh needs either manual refresh (after it is verified on Signet with funds) or an explicit opt-in to Bark maintenance, documented as such.

## 6. Emergency exit

- Execution is **not implemented** (`startExit*`, `progressExits`, `drainExits` are never called). The app offers explanations plus two **read-only** SDK calls: `estimateEmergencyExitFee` and `remainingExitTransactions`. The UI states that exits need on-chain funds for CPFP, take multiple confirmations, and must finish before expiry.
- Offboarding is not executed either.

## 7. Demo isolation

- `DemoWallet` imports nothing from the SDK, adapter or loader, and has no network code (asserted in tests by reading the source). The E2E suite fails if Demo mode requests any `2nd.dev` URL.
- It only accepts `DEMO-…` addresses, so a pasted real address can never be "paid". All ids start with `demo-`. DEMO is shown in the header, in a banner, and on every data card.

## Before any mainnet consideration (not done, out of scope)

1. An independent security audit of the web app and its hosting.
2. Consistent, encrypted, continuous DB backup with a tested restore.
3. Header-delivered CSP with SRI where applicable; reproducible builds.
4. Manual refresh / maintenance verified end to end, with a fee policy.
5. Exit execution with fee funding, monitoring and failure handling.
6. Stronger key protection: WebAuthn-PRF or hardware-backed keys, passphrase strength rules.
