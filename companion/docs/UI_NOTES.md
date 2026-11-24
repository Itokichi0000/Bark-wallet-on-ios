# UI refresh — handoff to Claude, 2026-11-24

## Presence redesign

Design spec, before implementation. This section supersedes the bottom dialogue panel described below. Her speech is luminous ivory with ink text; player replies are violet. There is no nameplate or surrounding menu panel. Shared sizes, colours, tails and motion live in `src/theme`.

Coordinates below refer to the stage beneath the safe area, MOCK banner and persistent HUD. Speech is above her head, with a curved tail ending toward her mouth. This avoids guessing a lateral face exclusion zone across poses. Reserve the measured bubble height before the top of her head; never translate the board camera upwards to fit a short viewport.

| Framing | 390 × 844 | 375 × 667 |
| --- | --- | --- |
| Home / send destination / story | 760pt full-figure canvas cropped at thighs/waist, face centred just below speech; body continues behind replies | 690pt canvas, same face clearance, minimum 260pt presence area; page scrolls if replies need more room |
| Amount, keyboard | 690pt canvas; retain head and question above the composer | same framing; scroll to composer, retain a minimum head area, keyboard never covers reply submission |
| Receive / scanner board | QR surface >= 200pt, full figure canvas derived from measured HOLD_BOARD geometry; entire head and board visible; speech above head | same QR minimum and uncropped head; vertical scroll instead of reducing the QR |
| Review | focus pose above a sober receipt containing the complete review and explicit send/auth control | receipt scrolls as one unit; no truncated destination or auto advance |
| Confirmed celebration | full figure fits presence area only while confirmed service cue is active | same; never synthesise a success cue from UI state |

Her bubble: max 70% of stage width, 17/25 typography; up to five visible lines, inner scrolling thereafter. Footnotes use 12/18 and share the bubble. Full line reserves its text height while typing; bubble silhouette interpolates by transform, not layout animation. QR caption follows the board and exposes the entire chunked address. Player replies wrap right, >=44pt; suggested reply is filled violet, alternatives deep violet. Four home icon replies are round with accessible labels/unread dot. Slim inline keyboard/dictation input follows them. Long text and large type reflow; overflowing pages remain scrollable.

| Motion | Duration / behaviour |
| --- | --- |
| Camera | 380ms eased transform on UI thread; replacement interrupts |
| Her bubble | 220ms scale from tail anchor + opacity; background resize uses transform only |
| Player reply | 160ms rise from thumb; other replies dim but remain tappable |
| Listening beat | 220ms local nod; newest tap cancels prior continuation; no beat for review/auth/submitting or Reduce Motion |
| Receipt | 280ms translate/opacity from hands; never delays controls |
| Ambient | slow transform/opacity behind avatar; no particles or camera motion under Reduce Motion |
| Reduce Motion | still renderer, no clips/beat/camera; short fades only |

Line-start light haptic and reply selection haptic respect `hapticsEnabled`. VoiceOver gets the full line once, not character announcements. Only one base loop plus one one-shot may be mounted. Existing payment guards and service-derived result cues remain authoritative. Simulator validation belongs to Claude; static checks do not establish visual/device validation.

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

## Avatar-first stage

2026-11-24 — Codex UI implementation. The supplied dialogue/motion/domain/i18n changes and new assets/tests were already in the working tree and were preserved. No internals, tests, package scripts, or frozen SwiftUI files were edited. No build, prebuild, commit, push, or upload.

### Layout and interaction decisions

- Home, Receive and Send share `src/components/stage.tsx`: the same room, one HUD (back where applicable, network, hide/show balance, compact sync explanation, settings), a large Noa, and one dialogue surface. These three native stack routes fade. MOCK and the red Mainnet notice remain outside scrolling content. Other routes retain their existing Companion strips and scene focus announcements.
- Home uses the routed homeHint, or the stage question when at rest. Receive/Send are the two primary answers; activity, coins, story/unread dot, and guide are compact secondary answers. Talk and mock practice remain reachable. Recent activity has been removed from Home.
- Dialogue content follows line → answer field → choices. The surface scrolls instead of truncating text, long labels/large type use one column, and controls retain >=44pt targets. The keyboard reduces the measured room viewport; the avatar yields height first. Review rises 18pt over 250ms using UI-thread transform/opacity; Reduce Motion uses opacity only.
- `StageAvatar` sizes the paper to min(screen width × .64, 280) with a floor ensuring the **inset surface itself is >=200pt**. At 375pt this is a 240pt paper / 211.2pt content surface. Head-to-waist close-up uses a 350ms UI-thread scale/translation; no transforms animate under Reduce Motion. On short screens and with large text, the close-up and dialogue scroll as one room: the QR is never reduced to squeeze both into one viewport. This is intentional; Claude should assess the scrolling feel.
- The renderer mounts exactly one clip at a time. A present cue plays present → hold; replacing it hides the board content immediately and plays putaway before the next cue. Durations come from `clipDurationMs` and start at the first displayed frame. Idle and unused clips are not decoded underneath. Expiring short service cues may finish their gesture; explicit pending/unknown fallbacks interrupt. Reduce Motion mounts only stills, including hold.png.
- Board content sits at HOLD_BOARD with a 6% inset and white background. QR content is static black/white, mounted only after present and the close-up transform finish. Its conservative quiet zone is at least four modules even for the minimum 21-module QR. The dialogue is a sibling, never an overlay over the code. The QR has a VoiceOver label; the address is nonselectable, and Copy's hint contains the full address.
- Receive retains focus-scoped autoSync.watch, existing address creation, q2 completion, and PAYMENT_RECEIVED detection. Menu-level present cues resume only after higher-priority cues retire. Confirmed incoming events dismiss the paper and supply catch from the service; the received amount comes from the matching confirmed movement. Copy/share remain explicit actions; faucet appears only on Signet.
- Send uses sendTurn for lines, choice lists and input presentation. Paste reads only on tap; scanning uses the existing CameraView/permission API inside Noa's board. Type reveals one destination field and a destination-check answer. Validation leads to a single amount field; the BTC/sats switch uses existing exact bigint conversion helpers (no floating point). Voice amount/max drafts, fixed amounts, spendable balance, max quote, destination revalidation and quote-expiry checks remain.
- The embedded PaymentReview shows all existing fields without a details toggle. The deliberate confirmation is after those fields and still calls authorize before wallet.confirmSend. A synchronous tap guard prevents duplicate auth/send side effects. Navigation removal and HUD navigation are blocked during auth/submission. Open-operation loading failure blocks confirmation; journal/service exceptions after authorization are conservatively shown as unknown, never failure. Pending/unknown retain do-not-resend copy, read-only reconciliation, Activity and Done, with no retry. Success poses are accepted only from the matching service event and succeeded reducer phase.
- Four small UI strings were added in both languages. No new dependency or artwork was required. Camera and navigation APIs were checked against [Expo SDK 58 Camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/) and [Expo prevent-screen-removal](https://docs.expo.dev/router/advanced/prevent-screen-removal/) plus installed declarations.

### Verification and Claude handoff

- Typecheck and all 12 suites / 117 tests pass. The existing Jest delayed-exit warning was traced with --detectOpenHandles to the real timeout at `AvatarOrchestrator.ts:15`, created by `tests/unit/avatar.test.ts:189`; it drains and the command exits 0. Neither file was changed.
- Native layout, camera scanning, actual WebP timing/alignment, VoiceOver, and authentication are **not simulator/device verified by Codex**. The existing unit suite does not render these screens.
- Claude: run 375×667 and 390×844, Japanese/English, 130–200% text, Signet/Mainnet+MOCK, hidden balance, offline/unknown balance, and a long real Ark address. Check HUD visibility, keyboard avoidance, inner dialogue scrolling, board-room scrolling, and that every review field is reachable before confirmation.
- Inspect present → hold → putaway → catch, tap/copy/share interruptions and resumption, new receive after returning from settings, Reduce Motion toggled while holding, rotation, focus/blur, and memory with only one active decoder. Scan the displayed QR from a second device; test permission denied/revoked, camera failure, repeated scan frames, cancel and reopen. The screenshot/asset bounds alone do not certify QR readability.
- Exercise scan/paste/type → validation error/valid → amount (sats/BTC/fixed/max/voice draft) → full review → back → auth cancellation/error → submitting → each result. Try fast repeated confirmation taps and hardware/gesture back while in flight. Incoming events during an unresolved send must not celebrate that send. Confirm reconciliation never sends a second payment.

## Talking + always alive

2026-11-24 — Codex UI changes on top of the existing uncommitted stage. Internals, tests, scripts, dependencies, speech settings, and frozen SwiftUI files were not edited. No commit, push, prebuild, build upload, or simulator launch.

### Implemented

- Shared `src/components/dialogue.tsx` drives Stage, Companion/HomeCompanion, and StoryReader: 45 ms per Unicode code point, 180 ms punctuation pauses, tap-to-complete, restart for a new line, and a bouncing finish marker. An invisible full-line text block reserves the final height before the first character. Animated text is hidden from accessibility; the stable accessible label contains the full line. VoiceOver receives one full-line announcement on iOS, Android uses the full-label live region. Reduce Motion and screen readers display the whole line immediately. Unfocused stages cancel typing and do not announce offscreen dialogue.
- Name tabs attach to translucent panels with luminous borders. Choices reserve space while hidden, stay out of accessibility/hit testing until visible, and enter at 40 ms intervals after typing. A completion tap, Reduce Motion, VoiceOver, and send review/auth/submission expose them immediately. All answer targets remain at least 44 pt. Companion lines are no longer truncated.
- `AnimatedAvatarRenderer` selects `baseLoop({ holding, speaking })` from the actual typewriter state. One base Image swaps sources with a 120 ms native cross-dissolve, plus at most one keyed one-shot. No four-loop stack. Existing present → hold → putaway and queued confirmed-result behavior remain. A local idle beat is explicitly interrupted when typing starts; normal service one-shots retain their existing playback behavior. Reduce Motion mounts still images only.
- `useLivingAvatar` runs the updated director on the stage, nonholding close-up, strip/story list, and story reader. Typing, holding/board transitions, review/auth/submission, Reduce Motion, and inactive surfaces suppress local idle beats. Returning after typing accounts for elapsed entry-gesture time instead of waiting another full clip.
- `AvatarLife` uses Reanimated shared values on the UI thread: ±3 pt / 3.2 s bob, 1.0–1.012 breathing scale, transform-pulsed ground glow, 220 ms speech pop, and press-in feedback toward 0.98 before the tap event. Close-up amplitude is 1.5 pt; avatar and board content share exactly the same transform. The close-up transform origin keeps facial/board movement small. All procedural transforms stop under Reduce Motion.
- Receive and send allocate room from the dialogue's measured full height before sizing the avatar. Receive uses two columns, concise paired Japanese/English labels, a compact short-screen panel, and a tighter close-up crop. Board content remains >=200 pt wide. Warning/status lines remain visible; the redundant printed receive address was removed from the panel, while explicit Copy/Share and Copy's full-address accessibility hint remain. QR sizing now includes its four-module quiet zone inside the board surface rather than clipping it. Long/error/accessibility content can scroll as a whole room. Network/MOCK/Mainnet warnings stay outside that scroll area.

### Missing asset handoff — not finished

The brief's five new files are **absent** from `assets/avatar/motion/`: `speak.webp`, `holdspeak.webp`, `sway.webp`, `hairfix.webp`, and `peek.webp`. Searches of the checkout, temporary/download folders, and user files found none. A location request was sent to the owner.

To keep the checkout runnable, the five CLIPS entries at the top of `AnimatedAvatarRenderer.tsx` explicitly use existing-art fallbacks: speak → talk, holdspeak → hold, sway/peek → search, hairfix → nod. These are not the requested new animations: the held-board fallback has no speaking mouth, and the talk fallback is not an infinite lip-flap loop. Do not treat the asset-dependent part as completed. Once the real files arrive, replace these five require paths with their matching filenames and verify actual looping, alignment, and transition timing.

### Checks and remaining review

- `npx tsc --noEmit`: passed. `npx jest --runInBand`: all 12 suites / 117 tests passed, exit 0. Existing Node localStorage and Jest delayed-exit warnings remain. Tests were not edited. `git diff --check` passed; every renderer asset reference resolves.
- Temporary checks outside the repo passed for character/punctuation timing, tap completion and cancellation, new-line restart, Reduce Motion, full-line VoiceOver announcement count, protected-step immediacy, idle-beat interruption, one-base/one-shot tree structure, board lifecycle, and a confirmed catch retained behind putaway. These use hook/timer stubs; they do not validate native animation rendering.
- System-font text measurements (AppKit with explicit line heights) plus layout/board geometry checks covered Japanese/English at 375×667 and 390×844. Receive's calculated panel including margins is 216/256 pt (JA) and 202/242 pt (EN), with a 200 pt content surface and the entire paper inside the crop. Amount and bad-destination layout budgets also fit, including the longer other-server validation explanation. These are measurements/calculations, not screenshots or a simulator pass; arbitrary backend error detail and larger type retain scrolling.
- Claude: after the real assets arrive, verify both sizes on the simulator, then feel-check on device. Check lip movement, real crossfades/decoder memory, short-screen face/board/choices, QR scanning from a second device, keyboard and long error content, large text, VoiceOver announcements, tap completion versus navigation, and Reduce Motion toggled mid-line/clip. Review/auth/submission must keep immediate controls and no idle beats. Pending/unknown still must not celebrate or offer resend. Speech default and existing TTS are unchanged.

## Polish + bug pass

2026-11-24 — Codex. UI changes on top of the existing uncommitted stage and newly wired motion assets. Existing/concurrent internals and test changes were preserved. No edits to tests, domain, services, state, config, scripts, dependencies, or `SatsOS/`; no commit, push, prebuild, simulator launch, or upload.

### Senior game-UI critique

- The detached white QR square had the strongest contrast, competing with Noa's face and hiding the relationship between her hands and the prop. Preserve the illustrated rim/fingers and fill the safe inner surface with the QR and its required quiet zone.
- Secondary links lacked a common shape and visual rhythm. Receive/Send should be the first decision; destinations should be equal icon tiles, with conversation/practice tools in the dialogue header.
- The outlined name tab and detached end marker resembled debug labels. Give Noa a solid name plate, put the marker below the text, and use consistent 16pt screen gutters and bottom margin inside the safe area.
- The palette and character art already establish a coherent world. Keep them and spend available height on the sprite. A stronger balance pill and explicit sync state clarify the HUD without competing with the choices.
- The story strip had an accidental mid-thigh crop. Use a deliberate bust overlapping the strip. On short screens/large text the strip must scroll instead of consuming the page viewport.

### Implemented polish

- The held-board overlay is inset 10% per edge, beyond the roughly 8% finger intrusion visible in `hold.png` and inspected `hold.webp` / `holdspeak.webp` first frames. Geometry accounts for the slightly different width/height fractions in `HOLD_BOARD`. On 375/390pt screens the board is 250.04pt wide (near the requested ~240pt), with an exact 200pt QR/camera surface.
- `BoardQr` uses the encoder already bundled by `react-native-qrcode-svg`, drawing its actual matrix with exactly four white modules per side. No extra margin, logo, rounded QR clipping, or version-1 assumption. Versions 1/8/15 were checked against the encoder, including a long address-shaped payload and Unicode.
- Home has four equal 88pt icon tiles at normal text size, two columns at 130%, one column at 200%. Story has a separate unread dot/accessibility hint. Ask Noa is a 44pt keyboard icon in the header; the practice control is mock-only and visibly carries `MOCK` above its label.
- Shared stage answers use a 44pt minimum, 12pt radius, filled primary / outlined secondary, and 8pt gutters. English label width/font scale determine column count; an odd last answer spans the row. The home sprite fills the measured stage, with feet tucked behind the panel edge.
- Noa's plate is filled and sits in a header row. The finish marker is below the line at bottom-right, with a gentle 2pt/1.2s loop; Reduce Motion makes it static. Receive has a >=12pt amber Signet chip (red Mainnet override), plus a lavender waiting pulse with a static equivalent. The warning fits one line at normal size in both languages and wraps at large text rather than shrinking/truncating.
- Balance is a 14pt eye-labelled pill, moving to its own HUD row for large text. Sync has globe / refresh / warning plus localized OK / Syncing / Offline labels and still opens its explanation. No green payment-success symbol is reused for sync.
- All safety banners, complete review fields, explicit confirmation/auth, honest backup wording and pending/unknown handling remain. Story's amount-remaining countdown was replaced with neutral reading copy, per AGENTS.md. Confirmed totals and chapter availability are unchanged.

### Bugs found and fixed

1. **QR double shrink / excessive white area:** the caller reduced `size`, while the installed component already scaled the quiet zone inside that size; it also assumed 21 modules at every version. Drawing the actual matrix fixes both causes.
2. **Board geometry mismatch:** QR sizing could slightly exceed the shorter board dimension. Renderer/content now share the exact inner ratio, preserving the entire quiet zone and fingertips.
3. **Clipboard failure / stuck Copied:** clipboard errors were unhandled; clearing the timer on blur could leave Copied stuck on return. Errors now have localized feedback, focus resets the label, and late results after blur cannot re-arm it.
4. **Share/faucet failures:** rejected promises had no visible feedback. Both now show a localized warning while retaining the QR/actions.
5. **QR encoding failure:** invalid/oversized data could throw during render. The component reports a QR-specific error to the existing Retry/Done turn.
6. **Receive confirmation/store race:** the received dialogue advanced on an event ID before a matching succeeded movement was available. It now waits for that confirmed record and keeps the waiting status meanwhile.
7. **Stuck typewriter:** a rejected screen-reader query left its state undefined, preventing typing and choice reveal. Rejection now resolves to ordinary text mode.
8. **Stuck animation transition:** a one-shot's clock starts on display, which never occurs after a decoder error. `onError` now finishes the shot so holding/resting playback can continue.
9. **Keyboard coverage / numeric-pad escape:** the avoiding view began below an unaccounted HUD. It now surrounds the full safe-area screen, collapses the sprite while typing, and reveals the focused input after keyboard/layout changes. Amount entry has Done typing while the keyboard is open; refocus refreshes actual keyboard state.
10. **Scanner lifecycle / escape:** leaving Send closes scanning. Cancel scan is immediately available during typing; HUD back still cancels it. Camera keeps Stage's focus gate and the existing duplicate-frame latch, permission/error UI and retry.
11. **Stale BTC buffer / delayed cues:** changing destination/retrying a definitive failure could retain another step's BTC display buffer, and changing destination left the amount cue timer alive. These now clear at the relevant transitions. Clipboard-read failure opens manual input as recovery.
12. **Locked authorization state:** operation-ID creation was outside error handling after device auth. Failure before any submission now returns to Review with an error and releases the submit guard. Exceptions after submission remain unknown, never a guessed failure.
13. **Story list starvation:** a pinned strip with scaled multi-line text could consume the available list height. Short-screen/large-type `Screen` places it in scrolling content; normal 390pt screens retain the overlapping bust strip.
14. **Orphan/overflowing choices:** the third answer occupied half a row and width estimates ignored font scaling. Rows now span/reflow, tiles reserve equal height, and disabled/busy accessibility states match interaction.

All SendChoice/ReceiveChoice IDs retain explicit handlers. No new wallet action or pending/unknown retry path was added.

### Layout checks and verification

- AppKit system-font measurements and layout arithmetic covered Japanese/English at 375x667 and 390x844, at 100%, 130%, and 200%. These estimate React Native layout; they are not simulator screenshots. A pre-existing Swift cache path-alias error was resolved by using a fresh canonical `/private/tmp` cache.
- At 100%, Home's panel including margins is approximately 296pt: sprite room is ~270pt on 375x667 and ~386pt on 390x844. Tiles are 88pt; all interactive targets are >=44pt. Receive's panel is ~295pt; its minimum crop is ~389pt, with the whole board ending ~20pt above the crop bottom. Estimated overflow is ~2pt on 390x844 and ~118pt on 375x667. The short screen intentionally scrolls to preserve the face/prop relationship and 200pt QR; no choices sit outside scroll content.
- At 130–200%, choices stack and the whole stage scrolls. At 200%, estimated scroll is ~261–377pt for Home and ~408–524pt for Receive. Mainnet/offline/error messages add natural content height. Network/MOCK/Mainnet information stays outside the scroll. The warning chip can use two lines at 200% and is never ellipsized.
- Send review keeps all fields and final confirmation in unrestricted scroll content; no height cap, line limit or details toggle was introduced. Long destinations, errors, camera permission and Story-reader text can scroll. Actual native focus scrolling/camera/keyboard interaction still needs the agreed simulator/device review.
- Temporary checks outside the repository passed typing/punctuation, completion, new lines, Reduce Motion, VoiceOver and immediate protected steps; renderer checks passed real speak/holdspeak loops, typing interruption, board lifecycle and queued confirmed catch. QR checks passed matrix equivalence, four-module quiet zones, error recovery and crop bounds. These validate logic/geometry, not native playback.
- Final required command results are appended after the last code change. Tests were not edited. The current working checkout contains 119 tests rather than the brief's earlier 117.

Keyboard reference: [React Native KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview) and installed ScrollView/TextInput declarations. Claude's remaining device review: all hold/holdspeak frames and finger alignment, scanning the QR from another device, both sizes/languages, large text, keyboard transitions, camera denial/cancel/reopen, Reduce Motion changes, and review/auth/pending/unknown/confirmed-result flows. No real payment or device-auth result is claimed.

Final checks: `npx tsc --noEmit` passed; `npx jest` passed **12 suites / 119 tests**, exit 0. Existing npm `node-linker`, Node localStorage and Jest delayed-exit warnings remain. `git diff --check` passed. No tests were changed by this pass.

## Review bug fixes

2026-11-24 — Codex. Applied on top of the existing uncommitted UI and Claude internals changes. Only UI-owned files and this note were edited. Tests, internals, dependencies and `SatsOS/` were not edited; no commit, push or prebuild was run.

1. **Receive board persistence:** `usePresentBoard` now returns a memoized local presentation from the screen's showing/scanning state. It does not subscribe to or play orchestrator cues. Stage keeps that presentation through reaction/menu/voice changes; relevant cue lines can change without withdrawing or remounting the QR. Existing result safety filters run first; a valid catch/celebrate/unknown result can take over the visual, and leaving the step removes the board request.
2. **Scanner delay:** scanning enters the hold pose directly, bypassing the present one-shot. The camera or permission controls mount immediately in the focused stage. Removed StageAvatar's additional 350ms settled-content gate, which also unmounted content on layout changes. Cancel, permission denial/retry, duplicate-frame protection and blur teardown remain.
3. **Stale form-error cue:** every Send `FORM_ERROR`, including quote expiry, goes through a UI helper that cancels the amount-typing timer and calls `avatar.cancel()` before dispatching the existing reducer action. Review fields, quote-age guard, explicit confirmation, device authentication, submission locks and result handling remain intact.
4. **Home command replies and hints:** a cue with a line at voice priority or higher wins; otherwise Home renders the hint, including offline/time-of-day hints with no route. A route belongs only to the line being shown. `talk.stage.ask` is a secondary prompt above choices.
5. **Sync modal decoder count:** Stage passes `showCompanion={false}` to SyncStatus, so its explanation modal contains text without a second animated Noa. Opening it can change the dialogue but cannot withdraw the board.
6. **Deferred destination checks:** scans/pastes received while max/quote holds `editLock` retain the latest destination. Releasing either lock wakes the deferred validation. New destination edits supersede it; blur clears it and invalidates in-flight validation. Clipboard completion after blur is ignored. No destination is submitted by this queue.
7. **Receive again:** the confirmed received step now offers `もう一度QRを出す` / `Show the QR again`. It clears `receivedId` and returns to the existing address's showing step. The existing result filter prevents the prior catch from taking over this renewed board.
8. **Hidden balance:** the send amount step uses the HUD's `••••••` mask whenever `balanceHidden` is enabled.

Additional stage review: the board's cue-dependent `avatar.play` effect is gone, so ordinary cues no longer trigger re-present effects. Reviewed copy/amount/typewriter/choice/idle/clip timers for cleanup; removed the settled timer and added explicit cancellation of stage zoom, review-panel and avatar press animations. Renderer structure remains one source-swapping idle/speak/hold base Image plus at most one keyed one-shot; Reduce Motion mounts still artwork. Home's command modal already unmounts the Stage avatar, and the sync modal now adds none.

Validation: `npx tsc --noEmit` and `npx jest` passed; Jest reported **12 suites / 119 tests**, exit 0. `git diff --check` passed. Existing npm `node-linker`, Node localStorage and Jest delayed-exit warnings remain. No test files were changed. A temporary hook/element harness outside the repository additionally checked board persistence through reaction/menu/voice cues, confirmed-result override and return, text-only sync, immediate camera content, a scan queued behind the max-on-mount request, hidden balance, and Home voice/hint precedence with correct route selection. These are logic checks, not native rendering or camera validation. Claude's simulator/device review still needs to exercise copy/share/HUD taps while holding the QR, scan permission/cancel/reopen, max+scan/paste timing, QR after receipt, Reduce Motion and native animation playback.

### Presence redesign — implemented handoff

- Shared `SpeechBubble`, `SpeechFact`, `Reply`, `ReplyComposer`, `PlayerBubble` and a cancellable turn controller in `src/components/conversation.tsx`; tokens extend the existing theme. Ivory/ink speech contrasts with violet player replies. Speech reserves its complete text while typing, scrolls after five lines, resets scroll for a new line, and announces once in full to VoiceOver. Silhouette resizing, entry, camera and reply animations use only transforms/opacity.
- Home, Receive, Send and the story reader use the same presence stage. The avatar continues behind unboxed replies. The held board uses its measured geometry, has no vertical crop offset or breathing-scale drift, and keeps its QR quiet zone and >=200pt surface. At phone widths the board imposes a tall scene: scroll to its caption/replies rather than shrink it or cut off her head. The full address is selectable below the board.
- Home has four round icon replies, unread dot and native inline text/dictation input. Commands still go through the existing parser/policy and can only speak, navigate or prefill. The old command sheet, nameplates, delayed-choice wrapper, HomeCompanion and unused result-strip wrapper were removed.
- Address and amount are composed in violet player bubbles. Amount keeps unit selection, Max, fixed-amount locking, hidden-balance masking and its dedicated review arrow. The keyboard uses the existing platform avoidance, and keeps her question outside the scrolling input area while open.
- PaymentReview and its deliberate send/back controls share a sober receipt. Validation, quoting, authentication, submit lock, unknown-outcome handling and reconciliation implementation were compared with the beginning-of-task snapshot and are unchanged. No local success cue is synthesized. Confirmed one-shot playback reports its framing to keep the full-body view until that clip ends.
- Secondary screens retain in-flow reserved space for a small bust with a tailed bubble. On compact/large-text devices the strip remains in the content scroll, so it cannot cover the list or consume its viewport.
- Player-reading pass: removed duplicate input validation panels and the generic menu prompt; moved address/network/waiting/error/result facts into speech, kept reply choices available during typing, and prevented automatic send progression. The review remains the deliberate visual exception.

Validation: `npx tsc --noEmit` and `npx jest --runInBand` (12 suites, 119 tests). Tests themselves were not edited. Jest prints a delayed-exit warning but exits with code 0 after its existing timers expire. `--detectOpenHandles` identifies two timers from `AvatarOrchestrator.ts:15`, created by `tests/unit/avatar.test.ts:189` and `:233`; leave their cleanup to the internals owner. No simulator/device rendering or performance claim is made by these checks.

Claude's simulator/device pass:

1. Capture Home / Receive / Send destination / Send amount / Review / Story at 390×844 and 375×667. Inspect face clearance below the HUD, tail direction, continuous close framing, receipt from hands, and no menu-panel silhouette. Check longest English and large Dynamic Type; speech scrolls and all replies remain reachable.
2. Receive: present → hold → putaway, full head, board corners/fingers/quiet zone, QR scan with a second device, full selectable address, Copy/Share/Signet faucet, offline waiting and confirmed incoming only. Scanner: permission denied/retry, camera in the board, cancel during animation. Expect vertical scrolling on constrained screens, never a reduced QR.
3. Home: keyboard and iOS dictation; balance/unknown/help/seed requests and a send draft; typed reply remains visible; rapid replacement taps cancel the old 220ms continuation. Check haptics off and no per-letter ticks. Background/return and navigate away during the beat.
4. Send: invalid address, paste, fixed amount, sats/BTC precision, Max and masked available balance, keyboard arrow; quote failure/expired quote; every review field and full destination; explicit send → device auth, auth cancellation/failure, double taps. Pending/unknown retain 'do not resend', offer only allowed actions and never celebrate. Confirmed success zooms out; no replay after a stale result.
5. Story: tap scene/speech to finish typing then advance, Next/Back and final completion; no unlocking prompt that urges spending. Secondary lists/settings/guide/seed/recovery reserve bust height. Seed remains authenticated-only.
6. VoiceOver: one full-line announcement, ordered named reply buttons, QR/address accessibility and no focus trap in inner scrolling. Reduce Motion: no WebP clips, camera/nod/particles/scaling; still images and fades. Profile on the oldest supported device: one base loop + at most one one-shot, UI-thread motion, interruptions within 400ms.

### Simulator presence follow-up — 2026-11-24

This section supersedes the earlier instruction to scroll Receive to reach replies. Changes are limited to UI-owned files and this note; existing internals/test changes were left intact.

- **Receive / scanner:** Stage now reserves the caption and reply footer outside the scene. The remaining height belongs to speech and the avatar. The foreground board uses the original hold artwork (including rim/fingers) at 200–240pt, with the full head framed independently above it. This is necessary on 667pt phones: scaling the original entire figure to a 200pt board leaves too much space above the board. The foreground QR is sized from the measured prop, retains four quiet modules, and the portrait/board never extend into the caption or reply footer. At the smallest layout the QR surface itself is about 160pt; the **board**, as requested, remains at least 200pt. Receive displays its QR immediately. The redundant online waiting sentence was removed; offline, syncing, error and confirmed-receipt facts remain. Copy/share/faucet/done stay visible during typing and reactions. Scanner cancellation stays in the footer; camera permission buttons use compact 44pt controls. Received switches to the result scene with QR-again/done/copy in the same reserved footer.
- **Home startup investigation (item 2):** there was no explicit eight-second establishing timer in the current UI. `useLivingAvatar` did contain a `CLIP_DURATION_MS + 160` entry-rest gate (5,227ms), but it does not drive the dialogue clock or camera. The actual startup dependencies found were (a) `useDialogue` waiting for the asynchronous screen-reader query and then chaining each 45/180ms timeout from the *previous callback*, accumulating delayed-frame time, and (b) the renderer initially mounting the greeting one-shot and hidden idle base before an effect replaced the shot with the speaking base. The screenshot's exact eight-second native stall was not reproduced/profiled in this pass, so decoder latency is not presented as a measured cause. Home now starts directly at conversational framing (zero establishing hold, including re-entry); scene greetings are locally rendered as idle, and speaking initialises directly on the speaking base. The typewriter starts independently of the accessibility query/clip, uses elapsed-time deadlines, preserves the 180ms punctuation beat, and catches up after a late JS frame. An accessibility response of `false` no longer restarts the line; VoiceOver/Reduce Motion still reveal the whole line immediately. Confirmed-result clips keep their own framing and safety filters.
- **Home controls:** all four icon replies display the existing translated short labels. The right-aligned rows have consistent spacing, the composer remains full width, and the practice chip shares their right edge. Avatar clipping ends before the controls, so her forearms cannot sit behind the stack. While the keyboard is up, the redundant practice chip is omitted; the MOCK banner stays visible.
- **Inputs / review:** long form content has a bounded scroll area above pinned replies, and focused inputs are revealed on keyboard/layout changes. The amount font becomes 28pt while editing so its entire input row fits the smallest viewport. Manual destination editing keeps Scan/Paste visible; the redundant Type/Clear entry choices return when the keyboard closes. Review fields remain complete and scrollable, with deliberate review actions below them in a separate footer. The existing quote, authentication, submission, pending/unknown and reconciliation handlers are unchanged.
- **Story list:** the bust/bubble is a non-shrinking in-flow footer with explicit top clearance. Short-screen lists retain their inline companion after the cards. No list content is placed underneath an absolute strip.

#### Layout arithmetic

AppKit system-font measurements (an estimate of native text layout, not simulator screenshots) covered Japanese and English at 375×667 / 390×844 and fontScale 1 / 1.3. The receive calculation uses a 132-character address, chunked into groups of four, including its full caption and four replies. Safe areas, MOCK banner, HUD, speech padding/tail, reply wrapping and bottom padding are included.

| Screen / scale | Receive space for head + board, JA / EN | Prop height |
| --- | --- | --- |
| 375×667 / 1 | 316 / 316pt | 240pt |
| 375×667 / 1.3 | 251 / 259pt | 203 / 211pt |
| 390×844 / 1 | 440 / 388pt | 240pt |
| 390×844 / 1.3 | 386 / 386pt | 240pt |

The board requires a minimum of 248pt including a 48pt complete head; short-layout speech can use the full screen width. Ordinary showing content, address and replies fit without scrolling in all eight cases. Exceptionally long errors/offline explanations can scroll **inside speech** while the board, caption and exit replies remain reserved. Receive preparing/error/received, scanner, every Send turn, and Home were also checked for reply clearance. Keyboard arithmetic covered 216pt and 291pt keyboards, including 130% text: it exposed a second row of redundant destination choices, which was removed while typing. The amount input row is <=80pt, above the keyboard, and Home's six labelled replies plus composer fit with its practice chip temporarily omitted. Review's full receipt intentionally scrolls. Story-reader speech remains bounded while its Next/Back footer is always reserved.

Temporary hook/element checks outside the repository passed typewriter punctuation/completion/late-frame catch-up, Reduce Motion and VoiceOver, no greeting one-shot at speaking startup, persistent board through reactions, confirmed-result override, immediate scanner, QR return, deferred scan after max, masked balance, and Home hint/voice precedence. These checks do not validate actual camera scanning, WebP decoding performance, native keyboard animation or simulator pixels. Claude's simulator pass should recapture the supplied screens, particularly the small-screen foreground-board composition, 130% text, keyboard entry, and a second-device QR scan.

Final verification: `npx tsc --noEmit` passed. The original checkout first passed `npx jest` with **12 suites / 119 tests**. During the final run, concurrent internals work added Lightning and four tests; an intermediate run caught the old Ark-only assertion before its owner updated it. After those external changes, `npx tsc --noEmit && npx jest` passed with **13 suites / 123 tests**, exit 0. No test or internals file was edited by this UI pass. The usual npm config, Node localStorage and Jest delayed-exit warnings remain. `git diff --check` passed. No commit, push, prebuild, simulator launch, payment or upload was performed.
