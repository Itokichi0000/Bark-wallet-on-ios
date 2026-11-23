# UI refresh — handoff to Claude

Implemented in the Codex-owned UI paths. No commit, push, prebuild, package/script/config change, or internals edit. `SatsOS/` is untouched. The existing avatar illustrations and room background remain local and unchanged.

## Important integration limitation

**Saved-seed display is reconnected (Claude).** `app/seed.tsx` now gets the words only from `wallet.revealSeed`, which authenticates on every call; see `UI_REQUESTS.md`.

New-wallet seed generation and confirmation remain available. They now require device authentication before words are generated/shown; words and quiz answers are cleared when the app becomes inactive. Existing recovery methods and wallet/backup method signatures are unchanged.

## Screen changes

| Screen | Change and primary action |
| --- | --- |
| Boot | Network tag and Mainnet warning also appear in error state; safe area used; spinning indicator cancels immediately with Reduce Motion. Retry remains primary on error. |
| Onboarding | Compact full-body avatar in a room-colored panel, shorter welcome, one “Get started” button, four-step progress after introduction. Network/Ark explanations are optional. Backup distinction has a short summary with expanded details. Seed safety notices remain visible. No dead back button on intro/creation/authentication. |
| Home | Large spendable balance in a card, explicit visibility and unit controls, stable send/receive buttons above the companion. Receive is primary with zero/unknown balance; Send is primary when there are spendable coins. Assets/activity move below the companion. Content scrolls on smaller devices; action rows stack with larger text. Sync is a separate button, avoiding nested press targets around status warnings. |
| Send | Destination, scan/paste icons, large sats amount, short Ark-only note, and a clear two-step path. Review remains mandatory; destination validation uses an informational indicator rather than a success tick. Final send requires successful device authentication; no-lock bypass removed. Pending/unknown retain do-not-resend text and only status-check/navigation actions. |
| Review | Full destination always visible, never collapsed. Network is read from the quote, with red Mainnet text. Method, amount, fee, total, and balance after remain visible. Total has its own inset panel; optional fee help. |
| Receive | High-contrast local QR with quiet zone, full address, one primary copy action and secondary share. Sync help is inline; faucet/unsupported rails/fee context are in Details. Receipt styling requires `status === "succeeded"`; waiting copy is hidden for that confirmed receipt. |
| Assets | Spendable amount first; total and balance breakdown under Details. Maintenance alert and expiry caveat remain visible; block-height detail is optional. VTXO help beside the coin list. Unsupported manual operations remain explanation-only. |
| Activity | SVG direction/status icons with text labels. Every pending/unknown card shows do-not-resend copy even while collapsed. Technical record fields expand per card; sync and payment-status help are available. |
| Settings | Backup first: create is primary when no backup exists, export is primary afterward. Export status and unverified-device-restore warning stay visible. Generation/time details collapse. Preferences and network switching follow; connection details are folded. SDK version comes from store info rather than a Bark-infrastructure import. |
| Seed | Shows nothing until the user taps reveal and passes device authentication; words are dropped on blur/background. No seed repository import. |
| Recovery | Shorter choice labels and backup/seed help; seed-only recovery limits remain visible. Input is masked, autocomplete/spellcheck off, and screen capture prevention enabled. Recovery calls retain their existing APIs. |
| Getting started / quests | Real icons, compact expandable task descriptions, next navigable task emphasized; completion uses a purple star, not payment-success styling. |
| QR scanner / command sheet | Network and MOCK indicators are present within overlays. Reduced Motion disables modal animations. Command content scrolls, respects bottom safe area, and example targets are at least 44pt. |

## Shared design and resources

- [Bitcoin Design Guide](https://bitcoin.design/guide/) — design-pattern reference, not a claim that this Ark app implements the guide's Lightning features. Applied [send/review](https://bitcoin.design/guide/daily-spending-wallet/sending/), [request/QR](https://bitcoin.design/guide/daily-spending-wallet/requesting/), and [manual backup](https://bitcoin.design/guide/daily-spending-wallet/backup-and-recovery/manual-backup/) principles: readable amount/unit, deliberate final review, unambiguous payment states, and distinct keys/backup explanations. Guide repository is [MIT or Apache-2.0](https://bitcoin.design/LICENSE); no Guide images or UI Kit artwork were copied.
- [Bitcoin Icons](https://github.com/BitcoinDesign/Bitcoin-Icons), MIT for the selected outline icons. Vendored from commit `bd5a9b0334073d4bb8899effeb06bcc400127700`. SVG strings live in `assets/bitcoin-icons/icons.ts`; original permission text is included as `assets/bitcoin-icons/LICENSE-MIT`. No Satoshi-symbol assets with separate licensing are included.
- `BitcoinIcon` renders these local SVGs using existing `react-native-svg` 15.16.0 (MIT). No added package or native module. No runtime remote image/font fetches. Existing `react-native-qrcode-svg` remains in use.
- Dark purple room colors retained. Stronger amount hierarchy, calmer panel borders, contrasting control borders, lavender primary buttons with dark labels, consistent 54pt buttons, and 44pt-or-larger help/navigation targets.
- `Disclosure` and `TermHelp` use inline expanded content: no animation, extra native dependency, navigation, external URL, or modal focus trap. Existing native controls remain; this change does not require regenerating native projects.

## Glossary

`TermHelp` accepts only a `GlossaryTerm`, never wallet data, amounts, addresses, or secret words. Each translated entry is 1–3 short sentences. All keys exist in both `ja.ts` and `en.ts`.

| Term | Entry points |
| --- | --- |
| Sync / 同期 | Home, Receive, Activity |
| Signet / Mainnet | Onboarding Details, Settings |
| Ark | Onboarding Details, Send, Receive Details |
| VTXO | Assets |
| Refresh / expiry | Assets |
| Fee | Payment review, Receive Details |
| Seed phrase | Onboarding, Settings, Seed, Recovery |
| Database backup versus seed | Onboarding, Settings, Seed, Recovery |
| Pending / unknown payment | Send results, Activity |

## Verification

- `cd companion && pnpm typecheck`: passed.
- `cd companion && pnpm test`: 9 suites / 92 tests passed, including i18n key/placeholder parity and forbidden logging checks.
- Temporary isolated device-auth harness: 7 mocked platform cases passed (no enrolled lock, success, three cancellation results, authentication failure, thrown platform error). This does not verify real Face ID/passcode behavior. No Claude-owned test files were changed.
- `git diff --check`: passed.

## Not verified here / simulator and device handoff

The app was not launched, rendered, or exercised in a simulator/device in this task; Claude owns that validation. The supplied screenshot was the starting reference, not evidence of the new layout. No screenshots of the changed UI are claimed.

Check Japanese and English at small iPhone width and large Dynamic Type; confirm QR quiet-zone fit, full-address wrapping, keyboard access to review/restore, sheet scrolling, VoiceOver names/expanded states, and real 44pt targets. Check Reduce Motion while the app is already running, foreground/background during onboarding and authentication, cancellation/no passcode, direct `/seed` entry, MOCK and Mainnet overlays, stale/offline balances, zero balance, pending/unknown reconciliation, and confirmed-only receipt visuals. Validate QR scan/share and the masked recovery input on the actual platforms.

The existing unit suite does not render these screens or cover the full payment UI. This handoff is working source plus passing static/unit checks; visual quality, platform behavior, genuine payments, backup export, and restore success are not certified by those checks.
