# UI refresh — handoff to Claude, 2026-11-24

Current implementation, superseding the previous card-heavy Home. Initial findings are in [UX_REVIEW.md](UX_REVIEW.md). All seven supplied findings were accepted; automatic updates still show stale/offline state and allow an intentional pull-to-refresh.

Only Codex-owned screens/components/wording and these UI notes were edited. Claude's already-dirty `_layout.tsx`, container, services, mock adapter, `homeHint`, scheduler and tests were preserved. `SatsOS/`, packages, native projects and scripts were not changed. No commit, push, prebuild, build or upload.

## Screen changes

| Screen | Current behavior |
| --- | --- |
| Home | Slim network/guide/settings header; amount switches sats/BTC on tap, separate eye and small breakdown link. No balance card or duplicate unit row. Noa is the main visual, with full cue text or `homeHint`, navigable when the hint supplies a route. Small Ask Noa and mock-only demo controls sit beside the bubble. Two recent payments (or loading/error/empty text) precede pinned Receive/Send actions. Hidden balance also masks recent amounts. Pending/unknown previews explicitly say not to resend. |
| Updates | `SyncStatus` shows last-update age or an offline/cache warning. Its 44pt question control opens a scrollable explanation with network/MOCK indicators; age updates every 30 seconds. No manual sync buttons on Home/Receive/Assets/Activity. Home/Assets/Activity support pull-to-refresh; the pull spinner belongs only to the user's gesture, so background sync does not repeatedly present a primary loading control. |
| Receive | Focus-scoped event listener is installed before `autoSync.watch()`; both are released on blur. QR, live waiting/offline/confirmed row, complete address and Copy share one panel. Retry appears for address-generation errors. Share and optional explanations follow. A receipt checkmark/amount requires `received.status === "succeeded"`. QR retains black/white contrast and 12pt quiet zone. |
| Send | Spendable balance sits beside the amount label; Max is a 44pt chip next to the field. Destination validation, quote, full review, final action, authentication, outcome and reconciliation paths stay intact. |
| Assets | Spendable number first, then a plain health sentence. Cached/offline information is explicit; urgent maintenance notices remain visible. Long expiry caveat and block details are folded. Coin list distinguishes loading, unavailable and empty. |
| Activity | Removed the primary update panel. Quiet age/offline line followed by records. Direction labels are neutral Incoming/Outgoing (入金/出金), and actual status stays explicit. Existing pending/unknown warnings remain visible even when details are closed. |
| Guide | One checklist with task icons, purple completion ticks, Try links and details opened by tapping the task. Backup learning stays inside its item; no payment-success styling or amount-based rewards. It is a local checklist, not a remote list needing fabricated loading states. |
| Settings | Security puts the seed action before optional glossary help and explains why it is unavailable in mock. Export-not-saved and unverified-device-restore warnings remain. |
| Seed | Explain authentication before revealing; disable reveal in mock, including direct route entry. Still uses only `wallet.revealSeed`. Ignore results after blur/background or a newer request; handle thrown errors without exposing exception content. Words clear on leave/inactivity and use 3/2/1 columns for width/text size. Capture prevention remains. |
| Recovery | Both recovery methods disabled in mock to match its explanatory notice. Clear phrase on screen blur. Seed-only limitations remain visible; existing restore APIs unchanged. Container-facing restore follow-up is in UI_REQUESTS. |
| Shared | Consistent 56pt default header (44pt back target + 6pt vertical padding), 20pt horizontal body inset and 14pt content gaps. New controls have 44pt minimum targets and opacity feedback where useful. Avatar uses the existing Reduce Motion-aware renderer; the help modal disables its fade with Reduce Motion. |

## Home layout arithmetic

At default text size the scroll container is exactly its available height (pull-down bounce is still enabled). The hero gets the remaining flex height. At `fontScale > 1`, content and the action row become scrollable, allowing full text instead of truncation. Speech is never line-clamped. Amount may shrink within its single line at default size; enlarged text may wrap.

Conservative budget: safe areas + 23pt MOCK banner + 44pt header + 70pt actions + 12pt content padding + 66pt balance + 44pt update line + 164pt recent section (two 60pt wrapped pending rows plus 44pt heading). Mainnet reserves another 26pt red warning. Empty/two ordinary rows leave more room.

| Viewport | Safe area used | Hero remaining, MOCK | With Mainnet warning | Longest EN speech + controls estimate |
| --- | ---: | ---: | ---: | ---: |
| 390×844 | 47 top + 34 bottom | 340pt | 314pt | 180pt |
| 375×667 | 20 top + 0 bottom | 224pt | 198pt | 180pt |

Text estimates checked all current ja/en `hint.*`, `avatar.*`, `voice.*` strings with macOS system-font measurement, the actual speech-column width and explicit 18pt line heights. This is a layout estimate, not an iOS render. The avatar is capped by both stage height and its 48% column width / `AVATAR_ASPECT` (about 300pt tall at 390pt width), so it does not overlap speech. Large amounts and enlarged text still need native visual review.

Receive uses a 210pt QR (234pt including quiet zone) at 844pt height and 152pt QR (176pt including quiet zone) at 667pt height. Long real addresses remain fully visible in text and may require scrolling; scan readability needs device verification.

## Safety and boundary checks

- Network tag and red Mainnet warning remain; MOCK banner is always visible, including update-help modal.
- PaymentReview still shows network, method, full destination, amount, fee, total and balance after. No review/authentication bypass or send-again option was added for unresolved payments.
- Only confirmed receipts use success styling. Guide ticks are purple task completion, not money confirmation.
- No seed is copied, shared, logged, spoken or passed to a tooltip. No unsupported payment rail or manual refresh/exit/offboard action was enabled.
- Backup warnings remain in Settings. New strings have matching ja/en keys and placeholders; existing Claude hint strings were preserved.
- Recovery's pre-existing direct BackupManager import needs a container-facing operation from Claude; see [UI_REQUESTS.md](UI_REQUESTS.md).

## Verification and remaining handoff

- `cd companion && pnpm typecheck`: passed.
- `cd companion && pnpm test`: 10 suites / 106 tests passed, including i18n parity, service safety and scheduler tests. No Claude-owned test file was edited.
- `git diff --check`: passed.
- Layout arithmetic/font estimates: both target sizes, ja/en, Mainnet + MOCK and two wrapped pending rows fit at default text size.

Not launched or rendered in a simulator/device here. Claude should verify both languages, larger text, Reduce Motion, long amounts/addresses, focus-scoped Receive watching, offline/error/empty lists, pending/unknown, hidden balance, and real authentication/QR behavior. The unit suite does not render the changed screens. No actual payment, export or restore result is claimed.

## Retained resources

Existing local avatar/motion assets and room background were reused. No generated art or remote fonts were added. Existing Bitcoin Icons remain under their bundled MIT license (`assets/bitcoin-icons/LICENSE-MIT`, upstream commit `bd5a9b0334073d4bb8899effeb06bcc400127700`) using installed react-native-svg. The previous [Bitcoin Design Guide](https://bitcoin.design/guide/) reference remains provenance for the send/review, QR and backup patterns; no new artwork was copied.
