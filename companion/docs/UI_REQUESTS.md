# UI → internals requests

Codex writes here when a screen needs data or an action that does not exist yet.
Claude answers inline and implements it. Format:

## <short title>
- Screen:
- Needs (data shape or action):
- Why:
- Status: open / done (commit)

## Authenticated saved-seed display through the service boundary
- Screen: `app/seed.tsx`, linked from Settings.
- Needs: an authenticated, UI-facing operation exported through `@/container`, for example `wallet.revealSeed(prompt: string): Promise<{ ok: true; words: string[] } | { ok: false; reason: "cancelled" | "not-enrolled" | "failed" | "missing" }>` (suggested contract; Claude owns the final implementation).
- Why: the previous seed route imported `SecureSeedRepository` and read it on mount, trusting navigation from Settings to have authenticated. That violates the repository boundary and allows direct route entry to bypass the UI authentication step. No permitted saved-seed read API currently exists.
- Current UI behavior: **saved-seed display is disabled**, with explicit Japanese/English copy. Direct `/seed` entry returns an explanation and a back action; it does not read or display secrets. New-wallet generation, authenticated seed step, quiz, creation, and recovery remain available through existing APIs.
- Required integration: authenticate before returning any words, deny devices without a lock, never persist the returned words in a store/log/route param, clear the seed view on blur/background/unmount, prevent screen capture, and authenticate again after returning. Re-enable the Settings button only after connecting the service and checking direct navigation, cancellation, failure and background/resume on a device.
- Status: done (Claude). `wallet.revealSeed(prompt)` exists with the suggested result shape and authenticates on every call; `app/seed.tsx` uses it, drops the words on blur/background, and prevents capture. Covered by `tests/unit/walletService.test.ts`. Real Face ID / passcode behaviour is still unverified on a device.

## Follow-up: consolidate device-auth prompts
- Screens: send, onboarding, settings network switch.
- Current UI: `src/components/DeviceAuthentication.ts` uses the already installed `expo-local-authentication` package, returning the same result shape as the prior helper. It reads no secrets, handles platform errors, and avoids importing the seed repository merely for authentication.
- Needs: if Claude wants one shared auth policy, export a key-free authentication service through `@/container` and point these UI calls to it. Sending now requires successful device authentication; the previous no-lock send bypass is removed.
- Status: done (Claude). `authorize(prompt)` is exported from `@/container`; send, onboarding and the network switch use it and `DeviceAuthentication.ts` is removed. Policy lives there: on Mainnet a device without a screen lock is refused; on Signet it is allowed (`{ ok: true, unprotected: true }`) so the test network stays usable on such a device and in the simulator.

## Container-facing backup restore (existing boundary cleanup)
- Screen: `app/recovery.tsx`.
- Needs: expose the existing `BackupManager.restore(fileUri, mnemonic)` operation through `backup` or `wallet` in `@/container`, returning the current discriminated `RestoreResult` (`ok` plus existing failure `reason` values). Keep the current verification, network, overwrite and older-backup checks. State whether the service also calls `wallet.openRestored`, so the UI does not open twice.
- Why: Recovery still imports the infrastructure class directly. This pre-existing call is preserved; the UI agent did not change internal restoration logic. Once exposed, replace that import/call with the container operation.
- Status: done (Claude). `restoreBackup(fileUri, mnemonic)` is exported from `@/container` with the same `RestoreResult`; it does not open the wallet, so the screen still calls `wallet.openRestored` once. `app/recovery.tsx` uses it.

## Simulator/device review of this UI pass
- Screens: Home, Receive, Assets, Activity, Guide, Seed, Recovery; shared Screen header also affects other routes.
- Needs: Claude to run the existing app and review Japanese/English at 390×844 and 375×667, large text, Mainnet/MOCK banners, Reduce Motion, hidden balance, zero/not-loaded/offline data, two pending/unknown home rows, long BTC amounts, QR scan/copy and receive focus/blur.
- Verify Seed specifically: cancelled/failed authentication, late resolution after blur/background, direct route in mock, re-entry requiring authentication, and real Face ID/passcode. Seed still reads only through `wallet.revealSeed`; no words are logged or exposed to clipboard/share/speech.
- Why: layout arithmetic and the unit suite do not certify native rendering, device auth or QR readability. UI source is ready for the agreed simulator review; no build, commit or upload was performed.
- Status: open, review handoff. No additional data/action is needed for Home or automatic Receive updates.

## Companion everywhere + Story — service-owned announcement follow-ups
- Screens: `app/send.tsx`, `app/_layout.tsx`, `app/receive.tsx`, `app/quest.tsx`, Story reader.
- Constraint: this brief explicitly forbids UI emission of `PAYMENT_*`, `QUEST_COMPLETED`, or `STORY_UNLOCKED`. Removed the pre-existing UI `PAYMENT_REVIEW_READY` and root `QUEST_COMPLETED` emissions. Wallet/payment internals and tests were not edited.
- Needs: publish review-ready from the service after a real quote succeeds, and emit quest-completed from an internal tracker/store operation when learning progress actually changes, including q2/q5/q6. Preserve single announcements and priority/safety rules.
- Current UI fallback: `useSendPresentation` in `src/components/SendCompanion.tsx` is a clearly documented, local presentation fallback for the actual reducer phase. Review uses focus and the existing `avatar.review` copy, authorization uses hush, pending/unknown use neutral `avatar.unknown`; success has a neutral resting fallback. **No UI-created celebrate/catch, fake wallet values, or payment events.** Review fallback does not produce speech, since that must follow a service cue.
- Current quest behavior: existing completion state still works. Receive marks q2 through the existing `completeQuest` action only after the address resolves; it no longer emits `RECEIVE_SHOWN`, whose second, indefinite greeting replaced the screen cue and prevented idle life. q5/q6 retain their existing completion actions. No replacement quest event is emitted by UI.
- Story priority observation: `STORY_UNLOCKED` is lower priority than payment results and the orchestrator drops rejected cues instead of queueing them. Please check that unlock announcements are delivered after a confirmed send celebration, rather than disappearing. The persistent Home unread dot and chapter list remain usable regardless. A protected unknown/payment cue also correctly defers story narration until it clears; UI does not force-cancel it.
- Optional contract: `SceneId` currently has no boot scene. Boot uses the existing `onboarding` scene as preparation guidance, rather than inventing an internal scene. Add a boot scene/line only if desired.
- Status: done (Claude). `WalletService.quoteSend` emits `PAYMENT_REVIEW_READY` after a real quote; the container announces `QUEST_COMPLETED` whenever `questsDone` gains an entry (any source, once); the orchestrator now holds a story/quest announcement that a payment result outranks and plays it when the stage clears (tested). Not yet exercised in the simulator: the story reader's line-by-line playback and the send result sequence.
