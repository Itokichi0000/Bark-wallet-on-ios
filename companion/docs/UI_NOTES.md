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

## Companion everywhere + Story

2026-11-24 — Codex UI pass. Existing Claude changes were present at the start and preserved; this pass changes UI-owned paths and these handoff notes only. No commit, push, prebuild, app build, or TestFlight upload.

### Implemented
- Added all 16 WebP clips to `AnimatedAvatarRenderer`. The idle image stays mounted; just one keyed one-shot is mounted. New cue IDs replay even the same clip. A short cue expiring into idle lets its current clip finish (including confirmed receipt catch); explicit new gestures interrupt it. Reduce Motion unmounts animated WebPs and uses the existing still renderer.
- Added memoized `Companion`, local/silent `useLivingAvatar`, `HudBubble`, and typed interaction/focus helpers. `Screen` owns the navigator strip as a normal flex sibling below its scrollable content and **above footer controls / the safe area**. It never overlays the QR, review, seed, or inputs. The keyboard hides it; short screens (<700) or fontScale >1.3 use a smaller portrait and a two-line preview. Tap the compact bubble to expand/read the full text; its accessibility label always contains the full line.
- Every route has a scene. Boot uses onboarding guidance because the internal scene union has no boot entry. Scanner/help overlays inherit the scene without a duplicate navigation announcement; command entry has a companion that hides with its keyboard. Onboarding intro uses one large companion, other steps the shared strip. Offscreen route companions unmount their animated content and idle timers. Home retains one large hero; cue subscriptions are inside that hero, not the balance/history route.
- `SCREEN_ENTERED` fires on focus, including returning Home. Entry retires only old low-priority greetings/reactions (`cancel(CuePriority.reaction)`), preserving payment and safety cues. No new shared blur cancellation. Removed Home `MENU_OPENED` and Receive's redundant `RECEIVE_SHOWN` greeting; address readiness still completes q2 using the existing settings action. Home uses its useful homeHint when idle or showing a screen greeting.
- Added interaction events for successful address copy/share, scan opening, paste, completed destination validation (deduplicated by input), debounced amount typing (450 ms quiet period; minimum 2 s between emissions), max, balance visibility, units/settings, glossary/disclosures/details, refresh, movement details, seed visibility, completed backup export call, review cancellation, and authentication prompts. No values, addresses, or seed words enter these events. `AMOUNT_ENTERED` remains on end editing. The typed balance reply now points to Home instead of putting a real amount in a cue.
- Send retains all review fields and the deliberate authenticated confirmation. Review/authorization use focus/hush presentation; submitting and results get a larger avatar above status content. Actual service cues supply send/celebrate/worry. Pending/unknown keep neutral guidance, the do-not-resend text, and no retry/success visual. Result display rejects unrelated payment-result cues. Confirmed receive catch remains visible in the fixed navigator while the QR stays the main content.
- Added `/story`: confirmed total from `storySentSats`, existing unit formatter, next-chapter progress, privacy masking of total/remaining/progress, honest no-pressure explanation, seven memory fragments, locked title/text protection, unread badges, and a visual-novel reader. Each line calls `avatar.play(storyLineCue(...))`; back/next work, only Finish marks read, and leaving cancels narration. A higher-priority safety/payment cue is preserved. Reader replaces the small strip; avatar uses about 45% of available height and controls wrap/scroll at large type. Switching from chapter list to reader resets scroll position.
- Home has Story with unread dot, Talk, and the retained mock practice control (three pills maximum). Story-unlocked bubbles navigate to Story. Guide links to Story and explains that its learning progress is separate from story amounts.
- Bubble motion uses an interruptible 260 ms Reanimated spring on transform/opacity, on the UI thread; Reduce Motion gets a 140 ms fade only. Native stack transitions are used with fade under Reduce Motion. No per-frame React state updates. All new copy is paired in Japanese/English.

### Validation and limits
- `npx tsc --noEmit`: passed.
- `npx jest --runInBand`: 11 suites / 112 tests passed, including translation-key and placeholder parity. Tests were not edited. Jest reports an open-handles warning after completion and exits 0; Node also prints a localStorage experimental warning.
- `pnpm typecheck` and `pnpm test --runInBand`: passed (11 suites / 112 tests, exit 0).
- Native visual/runtime validation belongs to Claude under AGENTS.md and has **not** been claimed from type/unit checks. No simulator or physical-device run was performed by Codex.

### Claude simulator/device review
1. Review 390×844 and 375×667, Japanese/English, 130–200% text, long English story lines, Signet/Mainnet and MOCK banners. Verify each scroll area, footer, QR, review field, seed grid and focused input remains reachable; compact bubble expansion must not trap content.
2. Navigate every route and back, open scanner and sync help, show/dismiss the keyboard, and switch to Story reader/list. Check one visible avatar per surface, no stale greeting after navigation, the portrait crop, and Home's three pills.
3. Wait 5–10 seconds after a screen gesture finishes; verify silent local idle gestures, same-clip replay with fresh IDs, interruption by new actions, catch finishing after its 4 s cue, and no idle gesture changing speech. Reduce Motion / avatar-motion-off must decode no animated WebP. Profile memory on device; code structure alone does not prove the native decoder's memory ceiling.
4. Exercise real validation invalid/valid, amount typing/end editing/max, review cancel, auth cancel/failure, quote expiry, and submitting → succeeded/failed/pending/unknown. Preserve full destination/fee/total/after-balance, explicit final confirmation, no resend for uncertain results, and celebrate only for the operation confirmed by the service. Also confirm incoming events during an unresolved send cannot produce a success pose in that result view.
5. In the 6,000 sats mock demo, c0–c2 should be open, c3 next with 15,000 sats remaining. Try 0/all-open data, hidden balance, BTC, read/unread badges, locked taps, next/back/finish, leaving mid-reader, and narration enabled/disabled. Check the pending announcement delivery issue in `UI_REQUESTS.md`.
6. Verify seed auth on every reveal, hidden on blur/background, no secret in cues/speech/clipboard/share; export cancellation must not turn the companion's safe-storage reminder into a claim that a file was saved. Existing backup honesty strings remain unchanged.

### Internal coordination
See `UI_REQUESTS.md` → “Companion everywhere + Story — service-owned announcement follow-ups”. The UI emits no `PAYMENT_*`, `STORY_UNLOCKED`, or `QUEST_COMPLETED`. Review visuals have a local presentation fallback; service-owned review speech, quest announcements, and delayed story-unlock delivery need internal follow-up.
