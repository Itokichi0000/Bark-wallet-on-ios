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


## Lightning

2026-11-24 — Codex. Wired the existing internals through UI-owned files only. Ark remains the default. Receive shares Send's sats/BTC composer (no Max), creates a fixed invoice, holds its unchanged QR through showing/claiming, and copies/shares the original invoice. Its bounded caption contains method, amount, optional fee/expiry, fixed-payment and keep-open notes, and a shortened invoice. The practice chip is available on Receive. Polls run approximately every three seconds only while focused/active, stop on receipt, settlement, expiry or teardown, and ignore obsolete responses. Neither claiming, unknown nor the polling result creates success; the existing PAYMENT_RECEIVED + succeeded movement path remains authoritative.

Send shows method, shortened invoice and description; fixed amounts remain locked. Review retains the full destination, all financial fields, deliberate confirmation/authentication and adds the Lightning note. Scanner strings reach validation unchanged. Activity uses method labels and shortened Lightning counterparties. Japanese/English capability wording and Mainnet fallbacks were updated.

Checks: temporary hook/element checks outside the repository cover creation locking/retry, stale responses, focus/background/unmount, expiry/unknown/claiming/settled, cue-only receipt, exact QR/copy/share, unit conversion, Mainnet gating, scanner URI passthrough and fixed send amounts. AppKit font measurements plus layout arithmetic cover every Lightning receive step at 390×844 and 375×667 in JA/EN, at 100%/130%, including 216/291pt keyboards. Replies stay reserved; invoice metadata scrolls within its caption, and the receive composer keeps its input/unit controls visible. These are estimates and logic checks, not native screenshots or actual payment tests.

Claude must verify:
- Capture both sizes/languages with keyboard, errors, long amounts, copied label, large text and Reduce Motion; check caption scrolling, full head/board and scan a real invoice QR from another device.
- Mock create → practice chip → confirmed receive → new invoice; create failure/retry, Ark return, background/return, awaiting expiry and ambiguous/claiming results without success visuals.
- Bare BOLT11 and `lightning:` QR/paste, fixed 2,100-sat mock invoice, amountless invoice, description, full review/auth cancellation and confirmed/pending/unknown reconciliation. No pending/unknown retry or resend.
- Mainnet has no Lightning option or supported-payment claim. Verify Signet receive fee/expiry and receipt-event correlation with the real adapter. See UI_REQUESTS for mock URI/multiple-request gaps.

No commit, push, prebuild or simulator launch was performed. Concurrent internals, voice, package and test edits were left to their owner.

Final checks: `npx tsc --noEmit` passed; `npx jest` passed **14 suites / 127 tests** (the checkout now includes four concurrent voice tests beyond the brief's 123). `git diff --check` and the temporary Lightning hook/element and layout checks passed. Existing npm config, Node localStorage and Jest delayed-exit warnings remain. Tests were not edited by Codex. The UI also independently enforces Signet for Lightning because the mock currently advertises availability on Mainnet.

## iOS operated pass 1 — 2026-11-24

Codex follow-up to Claude's real-tap screenshot sheets (`s2`, `s3`, `s4`, `badtyping`). This pass changes UI-owned files only; pre-existing internals, package, voice and test changes remain untouched. The screenshots are the before-state evidence; this pass did not launch/re-drive the iOS simulator.

- **Literal entry:** destination/invoice and recovery phrase fields share iOS `ascii-capable`, no capitalization/correction/spellcheck/autocomplete, `textContentType="none"`, and `smartInsertDelete={false}`. RN 0.88's public TextInput interface has no separate smart-quotes/dashes prop. Conversation input does not inherit these settings, so Japanese entry/dictation remains available. On destination changes, the UI invalidates obsolete validation, cancels the old reaction, and renders errors from the current reducer state (`INPUT_CHANGED` clears both check and formError). Amount changes likewise clear the old reaction and use the current formError. Recovery edits clear their local error.
- **Amounts:** editable send/Lightning amount composers focus on mount. Fixed invoice amounts stay non-editable. While typing, the unit control below the large numerals shows the grouped decimal string (e.g. `1,200 sats`, with no Number precision loss). Both use `returnKeyType="done"` and an explicit translated `inputAccessoryViewButtonLabel`; the native accessory only dismisses the keyboard. The composer arrow still deliberately advances to review/invoice creation. Removed the redundant separate send-amount keyboard-dismiss row. Talk's submit accessibility label is `talk.input.send`: 話す / Say.
- **Keyboard framing:** the shared Stage bounds the reply/form footer, reserving 72pt for the face and at least 68pt for readable, internally scrollable speech even on 375×667. Long helpers/replies scroll within the footer instead of consuming the face. Home's navigation replies temporarily yield to its talk composer while editing; the MOCK banner, network and HUD remain visible. The avatar uses a bust crop with transform-only camera changes via the existing Reanimated renderer; Reduce Motion uses immediate transforms and static artwork. Keyboard avoidance remains the existing native KeyboardAvoidingView; no native dependency/prebuild was introduced.
- **Review:** the review line and a 100pt/140pt bust are outside the receipt ScrollView. Only PaymentReview and its auth-error notice scroll. Send/back controls remain outside that scroll at the bottom. Network, method, full destination, recipient amount, fee, total, post-payment balance, warning and device-authentication path are preserved.
- **Held QR:** Ark and Lightning now share one complete held figure/renderer at one scale, rather than a tiny animated head plus independently enlarged hands. QR surface including its four-module quiet zone is 220pt at 390pt width, 205pt at 375pt, and never below 200pt. The original hold artwork's proportions require about 540pt vertically at 390pt for the head + board. When that does not fit, the held figure scrolls in its reserved viewport; it does not shrink the QR or distort the head. This supersedes the earlier note permitting a ~160pt QR. Check the native scroll/scan experience explicitly; all receipt caption/replies remain outside this scroll.
- **Lightning receipt:** method, grouped amount and expiry share one caption row; `receive.ln.fixed` is a shorter footnote in both languages; the fee is shown only above zero. `receive.ln.keepOpen` moves into Noa's speech footnotes, and the redundant truncated invoice row is removed (Copy/Share retain the full invoice). Text may wrap with long amounts or large Dynamic Type rather than truncate financial data.
- **Received framing / replies:** both receive methods keep the same centered, full-figure framing after a confirmed movement, including after its short success cue expires. Success still requires the matching cue and a succeeded movement. Real Copy/Share/method/Signet-faucet/Done replies share one right-aligned wrapping group. MOCK simulate-arrival is a separate yellow `MockChip` in that group, shared with Home; it is no longer a conversation bubble. The faucet remains distinct and is also available while showing a Signet invoice.

Validation: `npx tsc --noEmit` passed. Temporary structural checks outside the repository exercised literal input settings, Japanese talk labeling/default keyboard, editable amount autofocus, sats/BTC grouping, localized Done without submit, keyboard space reservation at 375×667 / 390×844, fixed review ancestry, and one-renderer QR sizes. These are code/layout constraints, not native pixel or IME tests. Repository tests were not edited.

Claude re-drive checklist (same flows as the attached sheets):
1. JA, 390×844 and 375×667: type `tark1mockfriend0001` character by character, plus paste and scan; verify exact text. Enter a bad destination, then edit one character: red error disappears immediately. Talk must still accept Japanese and VoiceOver must distinguish 話す from 送る. Check recovery input with dummy words only.
2. Accept a destination: editable amount keyboard appears automatically. Enter `1200` and a long sats/BTC amount; inspect grouping, visible face/bubble, translated accessory, no automatic progression on Done, deliberate progression via the arrow. Repeat Lightning amount and test input errors. On a small screen, scroll the footer to reach any overflowed helper/reply.
3. Review: scroll the entire receipt; bust/line and bottom Send/Back remain fixed. Confirm full destination/all amounts, then Send → system auth; cancel and retry. Check pending/unknown wording and absence of resend/success effects.
4. Ark QR and Lightning invoice: same head/hand scale, >=200pt QR surface, no overlap with footer, scroll the held figure on constrained screens and scan using a second device. Check exact Copy/Share, short amount/expiry caption, >0 fee, keep-open footnote, distinct faucet and yellow MOCK chip. Simulate receipt: centered complete figure/arms for both methods, including after the cue expires.
5. Repeat keyboard/review/receive with Reduce Motion, English and large Dynamic Type. In particular assess the new held-figure scrolling and the reduced keyboard bust on the 667pt device; this pass makes no claim that those pixels have been re-captured.

No commit, push, prebuild, TestFlight upload or payment was performed.

Final checks for this pass: `npx tsc --noEmit` passed; `npx jest` passed **14 suites / 127 tests**. `git diff --check` passed. Jest still reports its existing delayed-exit timer warning, and npm/Node report their existing config/localStorage warnings.

## iOS operated pass 2 — 2026-11-24

Codex follow-up to Claude's `r1.png`, `r2.png`, and `receive_cut.png`. UI-only changes; existing internals and tests are untouched. This supersedes pass 1's scrollable held figure and invoice faucet.

- **Whole QR:** Stage measures speech and footer height with `onLayout`. Head, complete paper/QR, caption and replies now occupy sequential layout slots. The portrait has an independently sized bust crop; the paper/hands use a static crop of the same hold artwork, with an 8pt rim allowance. Only the portrait animates. There is no scroll viewport inside the held figure. The QR surface including its existing four-module quiet zone is 200–220pt at the requested widths. No caption, echo or reply can paint over it. At large text sizes, the entire composition can scroll below the fixed network/MOCK HUD, preserving the complete board instead of clipping its bottom.
- **Keyboard bust / amount:** reserve a 160pt hero slot at 390×844 (132pt on short screens), cap the footer against the measured speech height, and give keyboard busts a 650pt minimum figure scale, approximately a 100pt head in the supplied artwork. Review keeps its prior framing. Both amount composers put numerals, the 44pt unit control and arrow in one row, with grouped preview/balance/Max beneath. Overflowing footer content scrolls. The Lightning composer no longer includes its own Done button; the localized native keyboard accessory is the only keyboard-dismiss control.
- **Speech measurement:** typewriter text is now one native Text layout: visible prefix plus transparent unrevealed suffix. Removed the separately wrapping absolute overlay that could paint over the footnotes. Ordinary keyboard speech has a 120pt content allowance; longer warnings or large accessibility text scroll inside the bubble.
- **Faucet:** only the Ark showing step can display or invoke it. Lightning invoice Copy/Share, Ark return, Done and the distinct MOCK chip remain; invoice creation/claiming/receipt logic is unchanged.
- **Player echo:** submitted talk text and conversational reply chips use the right-aligned player-colour bubble, visible through the answer for five seconds. It survives keyboard dismissal and remains available with Reduce Motion. Repeated replies replace the previous echo; blur/protected review clears it. Navigation chips show their echo during the existing listening beat before navigation. On QR screens the echo takes its own footer space, never overlays the paper. Review/auth/send actions remain immediate and outside the conversational delay.
- **Activity:** expanded records start with plain status, method, amount, fee, created date, counterparty (when supplied), and completion date. Raw SDK status, kind and ID sit under a collapsed `詳細（技術情報） / Details (technical)` disclosure. Pending/unknown warnings remain outside that disclosure.
- **Coins:** disclosures now identify balances versus refresh/expiry information in both languages. Removed the extra sync timestamp from the balance disclosure; the existing SyncStatus is the single sync-time presentation on this screen.

Validation: `npx tsc --noEmit` and `npx jest` passed (14 suites / 127 tests). Repository tests were not changed. Temporary component/hook checks outside the repository exercised complete paper/QR bounds across 316–450pt hero allocations, measured keyboard space reservation, keyboard bust scale, single-layout typewriter text, one localized Done accessory, five-second echo with and without Reduce Motion, and immediate protected continuations.

AppKit text-width/line-height measurements plus the actual board geometry were checked for JA/EN at 390×844 and 375×667, 100%/130% type. At normal type, both languages fit without page scrolling. Estimated positions (not simulator captures):

| Size | Method | QR surface | Paper top–bottom | Caption begins | Replies begin |
| --- | --- | --- | --- | --- | --- |
| 390×844 | Ark | 220pt | 393–668pt | 676pt | 706pt |
| 390×844 | Lightning | 220pt | 369–644pt | 652pt | 706pt |
| 375×667 | Ark | 200pt | 279–529pt | 537pt | 563pt |
| 375×667 | Lightning | 200pt | 255–505pt | 513pt | 563pt |

A static composition preview using the actual hold artwork was also inspected. These checks establish layout constraints and estimated text fit, not iOS rendering or scan success. On 375×667 at 130% type, extra caption/reply content requires up to about 93pt of page scrolling. Long real addresses, fees, errors and player echoes likewise use measured footer space and can require scrolling; they cannot cover the QR.

Claude re-drive: capture both receive methods at both requested sizes, scan the entire code from another device, enter send/Lightning amounts with keyboard open, verify the single Done control and readable footnotes, submit `balance` and tap conversational replies, expand Activity technical details, and inspect Coins sync/disclosure labels. Repeat with Reduce Motion and large text. Native keyboard animation, camera scanning and new simulator screenshots remain for this re-drive. No commit, push, prebuild, simulator launch, upload or payment was performed.

## iOS operated pass 3 — 2026-11-24

Codex follow-up to `p3_in1.png` and `p3_in2.png`. This pass edits UI-owned components/screens and these notes only; the existing internals and test changes belong to Claude.

**Root cause of the collapsed amount composer:** pass 2 reserved a non-shrinking 160pt portrait (132pt on short screens), capped the reply footer at `available - portrait - speech`, and placed the form in another ScrollView inside that capped footer. React Native's vertical ScrollView defaults to `flexGrow: 1, flexShrink: 1`; disabling its scrolling does not remove those layout rules. The amount composer is taller than the address composer because it also contains the grouped value, balance and Max helper row. Once the reserved portrait and reply chips consumed the available height, the inner form viewport shrank to the visible sliver while its contents remained taller. This was a constrained nested-scroll layout, not an absolutely positioned portrait covering the input. Keeping the bottom safe-area padding above an already keyboard-avoided view also wasted space. Pass 2's arithmetic checked the footer cap without establishing the inner viewport's natural height, so its validation missed the regression.

- **Keyboard composition:** ordinary Stage screens now have one scene ScrollView containing natural-height speech, portrait, and a non-shrinking form/reply View. There is no separate capped editor/footer viewport. The portrait takes the measured remainder and shrinks to an 88pt slot; its figure scale can reduce from 650pt to 450pt (about a 70pt head with the current art). If larger type, long destinations, warnings or unusually tall keyboards exceed the screen, the scene scrolls and reveals the complete footer. The composer is never compressed to fit. Input components keep the same ancestry when the keyboard opens/closes.
- **Amount row / spacing:** while editing, the native value, unit control and deliberate arrow remain in one natural-height row. The redundant grouped-value/balance helper row returns when the keyboard closes; the HUD continues to show the available balance or its privacy mask. Editable Send's Max action moves to the chip row while typing, using the existing `send.max` translation; it still calls the same `fillMax`, and fixed invoice amounts still have no Max action. The existing localized native Done accessory only dismisses. KeyboardAvoidingView owns keyboard avoidance, automatic scroll keyboard insets are explicitly off, and keyboard mode removes bottom safe-area/footer padding. No second keyboard-height subtraction or focused-input scroll offset remains.
- **Speech:** normal Stage speech, including Lightning amount text and its network/error footnotes, uses a natural-height View instead of a bounded internal ScrollView. The whole line (including the typewriter's transparent suffix) participates in measurement. The existing Lightning wording is unchanged. Review and held-board speech retain their existing bounded treatment.
- **Home echo:** the player bubble is intrinsic Text with a 70% maximum width; a short `balance` stays one line and long text wraps. It sits in an absolute slot at the bottom of the portrait, directly above the replies. Long echoes can scroll within that slot. The echo does not participate in speech, portrait or footer height measurement, so it cannot push the replies/talk input down or cover the HUD. It starts fading 2.5 seconds after the answer continuation starts and is removed after the 140ms fade. Reading time uses a normal timer because Reanimated's `withDelay` skips delays under OS Reduce Motion; reduced motion still removes translation and preserves the reading interval. Blur, protected steps and replacement turns keep the existing cancellation behavior. Other scenes keep their echo in flow so the held QR remains unobstructed.

Layout verification used AppKit text measurements (JA/EN, 100%/130%) plus the locally installed React Native Yoga C++ engine in temporary files outside the repository. The model includes the banner, 56pt HUD, safe top, keyboard/accessory, full speech, input padding, 44pt controls and chip spacing. These are layout estimates and engine constraints, **not newly captured iOS pixels**. At 100% type the estimated keyboard layouts are:

| Viewport | Flow | Scene height above keyboard/accessory | Speech | Portrait slot | Composer | Whole footer | Overflow |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 390×844 | Send / Lightning amount | 372pt | 94pt | 162pt | 68pt | 116pt | 0 |
| 375×667 | Send / Lightning amount | 308pt | 94pt | 98pt | 68pt | 116pt | 0 |
| 390×844 | Home talk | 372pt | 68pt | 242pt | 62pt | 62pt | 0 |
| 375×667 | Home talk | 308pt | 68pt | 178pt | 62pt | 62pt | 0 |

Keyboard-plus-accessory reservations in this table are 346pt / 260pt respectively; actual iOS keyboard frames and `onLayout` measurements govern runtime, not these constants. At 130% on 375×667, the model requires 23–69pt of whole-scene scrolling for the amount flows; the full composer/chips remain visible after reveal, and earlier speech can be scrolled back into view. All 24 size/language/type/flow model cases preserve natural composer height and a visible full footer; adding an absolute echo leaves footer placement unchanged. Temporary hook/component checks additionally covered typed `1200` and long values, no nested editor viewport, natural speech, the single Done accessory, echo replacement timing with Reduce Motion, and immediate protected actions. No repository tests were edited.

Validation: `npx tsc --noEmit` and `npx jest` passed (**14 suites / 127 tests**); `git diff --check` passed. The existing npm config, Node localStorage and Jest delayed-exit warnings remain. No commit, push, prebuild, simulator launch, upload or payment was performed.

Claude re-drive: at both sizes, enter `1200` in Send and Lightning with the keyboard open; verify the complete numeric row/unit/arrow, chip row and native Done, then dismiss/reopen and switch sats/BTC. Verify editable Max versus locked invoice amounts. Submit `balance`, then a long Japanese sentence on Home: echo wraps without moving the controls/input, fades after the answer begins, and still lasts with Reduce Motion. Read the complete Lightning amount line and footnote. Repeat at 130% type and with a longer destination/error, checking whole-scene scroll access. Native rendering, keyboard animation/focus behavior and fresh screenshots remain for that re-drive.

## Voice + gestures — 2026-11-25

UI integration is implemented against Claude's `conversation`, `useTalk`, `gestureAction`, `matchSpokenChoice` and `spokenAmountSats` APIs. Internals, native modules and tests were not edited by Codex.

- Home offers voice + hands / voice only / later once, after settings hydration. Every answer saves `conversationOffered`; the existing navigation replies remain visible, including with the keyboard open. Spoken Home commands use the existing parser/policy path. The mic lives in the talk composer; Send, Receive and the Story reader keep it beside the touch replies. When voice input is off it explains the Settings toggle; tapping Noa retains the existing tap behavior.
- A single focused-screen UI hook routes final utterances and gestures through the same reply echo/action as touch. It ignores disabled/busy choices and does not shift the suggested reply when it is disabled. Amounts fill the composer in sats (including from BTC display mode); a later, separate normal confirmation is required. Fixed invoice amounts stay fixed. Review/auth/submission reject all speech/gesture actions and show `talk.send.review`; final send and device authentication remain on the original path. Pending/unknown text and no-resend behavior are retained.
- The owner's live partial text grows in the existing player bubble, then remains briefly as the final echo. The listening cue uses the existing `listen → focus` mapping and holds for the recognition turn. The bottom ring pulses in opacity/scale on the UI thread; Reduce Motion makes it static. Wave-back uses the wave clip without lip-flap overriding it. On a held board, only the portrait changes; the paper and QR remain mounted. Gesture feedback lasts 1.4 seconds. VoiceOver receives listening/finished announcements and labelled 44pt mic controls; replies remain available by touch.
- Both shared HUDs show a persistent eye chip only while `eyes === watching`. Denial/unavailability turns the affected preference off and shows Noa's localized iOS Settings explanation. Explicitly enabling again clears the previous attempt's UI error state so a second failure or a successful retry can be displayed correctly.
- Seed and Recovery block conversation for their entire focus interval. Onboarding conservatively blocks its entire flow, including authentication and transitions into words/quiz/backup. Focus blocks are counted so overlapping secret-screen transitions cannot unblock one another. Leaving restores the service's settings policy. Root AppState changes call `setForeground`; hydrated startup calls `syncEyes`.

Claude must verify on a physical iPhone (these are not certified by type checks or mocked hooks):

1. Fresh opt-in in JA/EN: all three answers persist, no repeated invitation; camera permission on first hands use, microphone + speech recognition permissions on first listen. Deny each, observe its toggle turning off and Noa's explanation, enable permissions in iOS Settings, then retry the app toggle. Verify unsupported on-device recognition/native module fallback as well.
2. Palm, Noa tap and mic each start one turn; tapping the mic finishes it. Her recorded voice and device read-aloud stop before recognition. Partial words grow, the final echo remains and her answer follows. Repeat palm while already listening; it must not end the turn. Try silence, interruption and rapid repeated taps.
3. Home navigation/balance commands; Send/Receive visible reply labels; unmatched text; sats and kanji amounts; BTC-to-sats fill; fixed Lightning invoice amounts. Verify no spoken destination is accepted. Separate amount confirmation must still lead through the full review and normal device auth. Do not perform a real payment for this review.
4. Wave greeting/clip and transient toast; thumbs-up chooses exactly the suggested enabled reply, never a later reply when the suggestion is disabled; Story swipes go next/previous and show the chosen reply echo. At review, authorizing and submitting, wave/palm/thumbs/swipes/spoken send only remind and never act. Pending/unknown retain their warnings and never display celebration or offer resend.
5. While listening/watching, navigate to Seed, Recovery and all onboarding seed steps. Check the actual iOS mic/camera indicators stop, including permission dialogs resolving late, interrupted authentication, rapid focus changes and background/resume. No transcript, seed words, camera frames or voice survive on those screens. See the service lifecycle request in `UI_REQUESTS.md` for async native start/stop follow-ups.
6. With hands enabled, enter/leave the rear QR scanner and background/resume it. Verify camera ownership and scanning from another device; the front-camera service currently has no explicit QR-camera handoff contract (request recorded in `UI_REQUESTS.md`). Confirm the camera HUD always agrees with actual native camera use.
7. At 390×844 and 375×667, JA/EN and large type: replies/mic remain reachable with the keyboard, live text and gesture toast; the full QR remains unobstructed. Check VoiceOver touch navigation and announcements. With Reduce Motion, ring and avatar are static; also test the existing avatar-motion preference. Inspect listening focus and wave playback on device.

Validation after the final UI edits: `npx tsc --noEmit`, `npx jest` (15 suites / 133 tests), and `git diff --check` passed. A temporary hook harness outside the repository additionally exercised spoken reply echoes, unknown/destination rejection, suggested/disabled choices, palm/mic behavior, amount-only fill, review locks, Story pages, stale callbacks, Home command routing, background/blur cleanup, hydration, repeated permission denial/retry, and overlapping secret-screen focus blocks. This validates JS routing with native APIs mocked, not sensor privacy, recognition accuracy, native camera arbitration or rendering. The existing npm configuration, Node localStorage and Jest delayed-exit warnings remain. No repository tests, internals or frozen SwiftUI files were edited; no commit, push, prebuild, simulator launch or upload was performed.

## Full-body drift — 2026-11-25

### Pass 3 — measured footer priority (current)

The three clipping fixes are implemented in UI-owned components. Home's full-body scale, source-pixel cap and drift functions are unchanged. This section supersedes pass 2's QR minimum height and 208pt keyboard minimum.

- Both normal and QR stages measure an **inner, naturally sized View with `onLayout`**, including the caption, player echo, composer, every wrapped reply row, MOCK chip, mic and footer padding. They no longer use the ScrollView content size as the footer measurement. Reply content never flex-shrinks. Changes in width, language, reply labels and keyboard state trigger a fresh measurement.
- QR stages give Noa only `available − speech − measured footer`. `hologramLayout` now fits her frame into that actual height, instead of forcing a 513/538pt stage. Caption-to-reply spacing is 4pt, with 8pt bottom padding. QR speech keeps its prior 68pt content limit. Normal-size QR surfaces remain 220/240pt plus their 12pt frame; short keyboard-transition stages use separate figure/panel lanes and fit both into the remaining height.
- Keyboard stages replace the 208pt figure minimum with a 48pt fallback, so the figure shrinks before the composer/replies. The ordering remains speech → figure → natural composer → wrapped chips → **8pt clearance** → native Done accessory → keyboard. Address entry and both amount composers share this allocation. Oversized content still has the existing reply scroller.
- Review/auth/submitting omit the mic, its conversation-context entry and listening feedback. The deliberate confirmation/authentication path is unchanged. Seed/Recovery already have no mic and disable avatar interaction; their companion now also explicitly suppresses listening/gesture feedback (including onboarding).

#### Bottom-edge checks and measurement limits

**These are AppKit text measurements + execution of the actual StageContent layout + React Native's bundled Yoga engine, not new iOS screenshots or real-tap measurements.** `xcrun simctl list devices booted` failed with an invalid CoreSimulatorService connection / connection refused. No simulator was launched. Fresh native bottom margins cannot be certified in this environment and remain for Claude's re-drive.

The temporary harness in `/private/tmp/full-body-pass3/` measures the current JA/EN strings, wraps all replies (including mic/MOCK), feeds the natural footer/speech heights into the actual `StageContent` `onLayout` handlers, then checks the resulting frames with bundled Yoga. **440 cases passed**: both requested viewport sizes × both keyboard states × both languages × 55 cases (Home normal/invitation; 14 Send cases including destination/error, editable/fixed amount, scanner, validation, quote, review, auth, submission and every result; all 11 Receive turns; all 28 story pages). Keyboard-up result/QR/story cases are transition stress checks; these screens do not open a keyboard themselves. The modeled keyboard+native-accessory reservation is 346pt, safe top is 47/62pt and safe bottom is 34pt. Actual keyboard heights, UIKit text metrics and insets must still be measured on iOS.

Measured **minimum footer-content clearance**, in points, from each harness layout's safe bottom edge (keyboard down) or top of the native keyboard accessory (keyboard up):

| Stage family (all states and JA/EN) | 390×844 down | 390×844 up | 440×956 down | 440×956 up |
| --- | ---: | ---: | ---: | ---: |
| Home normal / invitation | 8 | 8 | 8 | 8 |
| Send, including review/auth/submission/results/scanner | 8 | 8 | 8 | 8 |
| Receive, including Ark and Lightning QR/results | 8 | 8 | 8 | 8 |
| Story reader, every page | 20 | 20 | 20 | 20 |

With the modeled 34pt safe bottom, 8pt clearance corresponds to **42pt from the display bottom**; the story footer has 54pt. Review's receipt scroller takes the remaining room above its pinned actions; that space is not counted as bottom margin. Across all 440 cases the measured footer clearance is 8–40pt. This is a geometry result, not a claim about a newly observed home-indicator position.

Representative JA layouts, in points (footer includes all rows and bottom padding):

| State | Size / keyboard | Speech | Natural footer | Figure region | Full clip frame | Bottom clearance |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Ark QR, two reply rows | 390×844 / down | 96 | 130 | 458 | 340 | 8 |
| Lightning invoice, two reply rows | 390×844 / down | 96 | 152 | 436 | 318 | 8 |
| Ark QR, two reply rows | 440×956 / down | 96 | 130 | 555 | 420 | 8 |
| Lightning invoice, two reply rows | 440×956 / down | 96 | 152 | 533 | 415 | 8 |
| Send address | 390×844 / up | 76 | 118 | 178 | 160 | 8 |
| Send / Lightning amount | 390×844 / up | 76 | 124 | 172 | 154 | 8 |
| Send address | 440×956 / up | 76 | 118 | 275 | 255 | 8 |
| Send / Lightning amount | 440×956 / up | 76 | 124 | 269 | 249 | 8 |

Additional checks: 440 mic/context visibility cases passed; **26,112 extreme transformed full-frame corners** and **507,776 decoded alpha-row extrema** passed containment and at least 4pt QR clearance, including short keyboard-transition panels. No test files or internals were edited. Home's checked frames remain 432pt at 390×844 and 446pt at 440×956.

Native re-drive still needed at both sizes: tap through every turn above, dismiss/reopen the keyboard in Send address/amount and Lightning amount, check the full chip rows above Done, capture the QR second row and bottom margin after a reply echo, and verify no mic on review/auth/submitting/seed/recovery. Repeat with longer addresses/errors and larger text. Native keyboard/accessory animation, actual UIKit wrapping and scan readability are not certified by the harness.

Validation: `pnpm typecheck` (`tsc --noEmit`), `pnpm test --runInBand` (**16 suites / 138 tests**) and `git diff --check` passed. Existing Jest localStorage/delayed-exit warnings remain. No commit, push, prebuild, upload or payment was performed.

### Pass 2 — hero scale (historical)

This pass supersedes the framing, pixel cap and QR-lane measurements in the historical pass-1 notes below. All 24 installed clips were checked directly: **760×1358, 61 frames each except present (33) and putaway (30)**. No assets or internals were changed.

| Surface | 390×844 | 440×956 |
| --- | --- | --- |
| Home, invitation and normal replies | 432pt clip frame / **421pt visible idle head-to-toe**, 456pt minimum stage | 446pt maximum frame / **435pt visible idle head-to-toe** |
| Home horizontal wander | ±58.5pt (15% of width), further bounded by the full gesture rectangle | ±66pt (15% of width) |
| Receive / scanner panel | 395pt frame / **385pt visible**, 220pt QR inside 232pt panel | 420pt frame / **409pt visible**, 240pt QR inside 252pt panel |
| Send amount with keyboard | 208pt minimum stage → 190pt frame / **185pt visible** | Uses remaining measured room; a 282pt stage → 262pt frame / **255pt visible**; same 185pt minimum |

- Home uses compact speech, an 8pt overlap of its transparent bottom margin, a tail beside the head, 54pt icon replies and a 50pt conversation composer (all touch targets remain ≥44pt). The MOCK test button now sits in the HUD, removing its separate footer row; the persistent MOCK banner and network tag remain. Main reply IDs are excluded from the icon menu: six shortcuts during opt-in, four when Receive/Send are the main replies.
- Figure size includes motion bounds, anchors the feet just above replies and caps the largest breathing frame at **1358 source pixels / device pixel ratio**. At @3x the nominal maximum frame is 446pt and its +1.5% breathing peak is 452.7pt. Consequently the 440×956 figure stops at about 435pt visible rather than exceeding source resolution to reach 50% of that taller screen.
- Receive uses overlapping **transparent clip margins**, not a narrow avatar column. Its frame starts at x=-20pt, while the visible pixels remain inside the viewport. The panel is upper-right (x=154pt / 184pt, 4pt right inset). The figure reserves 110pt above its head and 8pt below its frame; minimum stage heights are 513pt / 538pt. Address caption and replies remain in the scroller below; at 390pt the later reply row may require scrolling. Extra available height places the feet next to the caption rather than leaving an empty lower stage.
- To make that placement safe, panel scenes play **pointdown → idle/speak**, using the decoded alpha envelope of those clips. Wide-arm `present`/other gestures are not played beside a QR. Panel drift is only ±3pt horizontally and ±1.625pt vertically, without tilt/scale. The panel fades in without sliding toward her; its QR and four-module quiet zone remain fixed. Home retains the existing bob, breathe and tilt; Reduce Motion still stops all spatial movement.
- Validation used the actual layout functions at **390×844 and 440×956**, @3x, plus every intermediate width from 390–440pt. **576 extreme transformed frame corners** passed safe containment and the source-resolution cap. **31,736 decoded alpha-row extrema**, across all frames of the three panel clips and extreme panel drift, passed viewport containment and ≥4pt QR clearance. Geometry estimates use default text size and representative measured scene budgets (684pt / 784pt; keyboard removes about 312pt); dynamic text/keyboard still uses onLayout and scrollable replies. These are geometry checks, **not fresh simulator screenshots**.
- Final `pnpm typecheck` and `pnpm test --runInBand`: **16 suites / 138 tests passed**. Jest's existing localStorage / delayed-exit warnings remain. Claude still owns simulator re-drive: capture Home t=0/3/6s and after opt-in, Receive and keyboard amount at both sizes, including Reduce Motion and large text. No commit, push or prebuild was run.

### Pass 1 — historical notes

This section supersedes the earlier bust/held-board/absolute Home echo framing notes. All active UI render paths now use a single full-body `StageAvatar`. No establishing shot, portrait zoom, cropped head layer, or QR-in-hands overlay remains in those paths. Payment cues and safeguards are unchanged; the display layer does not initiate wallet actions.

### Framing table

| Surface | Reserved layout / full-body policy |
| --- | --- |
| Home, Send destination/amount, Receive preparation/results, Story reader, send results | Separate measured speech, figure and reply regions. Figure fits its own region with 56pt motion/tail allowance, targets at most 56% of viewport height, and respects actual source pixel limits. Long replies scroll independently; they cannot cover or scroll the figure offscreen. |
| Keyboard open | Figure region is at least `0.312 × remaining scene height + 56pt`; the figure itself is at least 30% of remaining scene height at the target widths. Speech is bounded and scrollable; composers/replies use the remaining independent scroller. Home reveals its composer at the end; Send/Receive reveal the composer at the start. |
| Review / authorization / submission | A 160pt figure region (120pt for short screens / larger text), always head to toe, before the scrollable receipt. Deliberate final action and authentication are unchanged. |
| QR, Lightning invoice, Send scanner | Left full-body lane and right independent hologram. At 390pt: 126pt figure lane, 220pt QR surface + 12pt frame, 8pt gap, 12pt outer edges. At 440pt: 156pt lane, 240pt surface + 12pt frame. Figure is about 130pt / 161pt high respectively; it wanders only inside its lane. Caption and actions are below, never over the QR. |
| List / settings / other companion corners | 104 × 160pt region, or 88 × 136pt compact, with full-body containment. Keyboard no longer removes the companion. Onboarding's larger companion also uses containment, with speech above her. |

Framing includes the entire clip rectangle, not just the visible body. `expo-image contentFit="contain"` stays in use, without blur. `MOTION_PIXEL_HEIGHT` reads Metro's actual asset metadata, taking the smallest installed clip: maximum display pixels, including the +1.5% breathe, are <=1.25× source pixels. At this handoff, a RIFF header inspection found **20 clips at 480×858 and 4 at 720×1288**. Claude's 760×1360 replacements have **not** been verified as installed; Codex did not modify any motion assets. Restart/reload Metro after replacement to refresh asset metadata. Final sharpness depends on that replacement.

### Drift and dialogue

- One Reanimated UI-thread frame clock drives shared values; only transforms change per frame. No per-frame React state, layout changes, or JS callbacks.
- Horizontal mix: 0.76 sine at 13.7s + 0.24 sine at 9.1s. Travel is capped at ±27.5% of lane width and reduced by the actual full-body bounds. A question/typed reply introduces a gradual +0.18 right-side bias; idle removes that bias over approximately 1.8s. The independent periods avoid an obvious short repeat.
- Bob: 5pt at 6.7s + 1.5pt at 4.3s. Breathe: ±1.5% at 7.9s. Tilt: ±0.8° at 11.3s. A soft cyan/lavender floor glow follows her x; particles move oppositely at 4% of her horizontal offset.
- Stage speech follows the shared head x (including tilt), with the bubble clamped 16pt from the edges and its tail moving independently toward her head. Speech and replies have their own regions. Home's player echo now participates in the reply scroller instead of covering the figure.
- Reduce Motion: centred figure, no spatial drift/breathe/tilt/parallax or panel entrance; only idle/mouth clip loops remain. The existing `useReduceMotion` preference/OS gate is used. Typewriter behavior is retained.

### Hologram and playback

The panel materialises from the figure side using a 260ms translate/scale/opacity entrance and a transient cyan shimmer. After entry the QR has no animated transform, overlap or translucent overlay. Existing `BoardQr` rendering keeps exactly four white quiet-zone modules. Camera permission controls and preview occupy the same panel. The avatar plays `present` once, then `pointdown`, then the normal idle/speaking base; there is no held-board decoder or cropped duplicate portrait.

Playback mounts at most one base Image and one one-shot Image. One-shot starts/ends and base source swaps use a 120ms dissolve. One likely next clip is loaded into an explicitly released native ImageRef without mounting another Image view (present → pointdown; gesture → base; idle ↔ speak).

`QrScanner` awaits `conversation.setCameraSuspended(true)` before mounting the rear CameraView, and calls `false` after unmount/close. A module-local promise queue serializes rapid close/reopen/retry; stale completion cannot mount a camera after unmount. Suspension failure shows the existing camera-error/retry state. Native camera exclusivity still requires device validation.

### Validation and Claude re-drive

- `npx tsc --noEmit`, `npx jest --runInBand`: **16 suites / 138 tests passed**. `pnpm typecheck` / `pnpm test --runInBand` also passed. Existing npm configuration, Node localStorage and Jest delayed-exit warnings remain. No tests were edited.
- A temporary geometry harness outside the repository executed the actual `fullBodyLayout` / `hologramLayout` functions at **390×844 and 440×956**, @3x, for installed 858px and planned 1360px assets. **1,920 transformed rectangle corners** passed containment at maximum positive/negative wander, bob, scale and tilt; it also checked the pixel ceiling, QR lane separation and keyboard >=30% rule. These are geometry checks, **not screenshots or native text/layout verification**.
- Native screen validation could not run: `xcrun simctl list devices booted` reported an invalid CoreSimulatorService connection in this environment. No simulator was launched, no native build/prebuild was run, and 60fps/real-camera behavior is not claimed as verified.
- Claude: after replacing all clips, re-drive both widths in JA/EN and large type. Check Home (including opt-in, a long echo and keyboard), Send destination/amount/Max/review/authorizing/pending/unknown/confirmed/failed, Receive Ark QR / Lightning amount / invoice / confirmed receipt, Story reader/list, history/assets/settings/help and onboarding/seed/recovery companion corners. Confirm head-to-toe containment throughout a full drift cycle; scroll long replies and speech independently; verify no face/reply/QR overlap, the visible network + MOCK banners, and all existing protected text. Use MOCK/Signet for result-state inspection; do not perform a real payment for UI QA.
- Device: scan both Ark and Lightning codes from a second device; test permission denial/retry, rapid scanner close/reopen, background/foreground and navigation blur with hands enabled. Verify front-camera stop precedes rear-camera mount and ownership returns on close. Check 120ms clip transitions, present → pointdown, mouth loops, resource usage, Reduce Motion, and release-build frame pacing on the slowest supported device.

Only UI-owned components/renderers/theme and this note were edited for this task. Existing unrelated working-tree changes were retained. No internals, `src/conversation/*`, `modules/*`, tests or frozen `SatsOS/` files were edited; no commit, push, upload or prebuild was performed.
