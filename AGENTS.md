# Working agreement: two agents, one app

This repository's React Native app (`companion/`) is built by two coding agents.
The owner assigned the split: **ChatGPT / Codex owns the UI, Claude owns the internals.**
`SatsOS/` (the old SwiftUI app) is frozen; neither agent edits it.

## Who owns what (paths are under `companion/`)

| Codex — UI | Claude — internals |
|---|---|
| `app/**` (screens, navigation) | `src/domain/**` |
| `src/components/**` | `src/usecases/**` |
| `src/theme/**` | `src/infrastructure/**` |
| `src/i18n/ja.ts`, `src/i18n/en.ts` (wording) | `src/state/**`, `src/config/**`, `src/container.ts` |
| `src/game/*Renderer.tsx`, `HologramMenu.tsx`, `SceneBackground.tsx` | `src/game/AvatarOrchestrator.ts`, `IdleDirector.ts`, `quests.ts`, `src/voice/**` |
| `assets/**` | `tests/**`, `plugins/**`, `app.config.ts`, `package.json` scripts, CI, `scripts/**` |
| UI-only dependencies (icons, fonts) | `docs/**` (each agent may add its own notes) |

Do not edit the other agent's files. If the UI needs data or an action that does not exist,
write the request in `companion/docs/UI_REQUESTS.md` (what the screen needs, in which shape)
and build the screen against what exists today. Claude answers there and implements it.

## The contract between the two halves

- Screens read state from `useWalletStore` / `useSettings` and call methods on `wallet`
  (`WalletService`) and `backup` from `@/container`. Nothing in `app/` or `src/components/`
  imports the Bark SDK, the seed repository, or anything under `src/infrastructure/bark`.
- The avatar is display only: it renders an `AvatarCue`. It never triggers wallet actions.

## Rules the UI must keep (these protect money; do not trade them for looks)

1. The network is always visible (SIGNET / MAINNET tag); Mainnet keeps its red warning.
2. MOCK mode keeps its always-visible banner.
3. Sending: the review screen shows network, method, full destination, amount, fee, total and
   balance after; the final send is a deliberate user action followed by device authentication.
   Do not add shortcuts that skip review.
4. After a send, `pending` and `unknown` are never shown as success or failure, never offer
   "send again", and keep the "do not resend" wording.
5. Success visuals (celebrate pose, confetti, green ticks) appear only for a confirmed result.
6. The seed phrase appears only on the seed screen after authentication; never in a tooltip,
   toast, log, clipboard, share sheet, or speech. No auto-copy.
7. Backup status stays honest: "not saved outside this device" and "restore not verified on a
   device" stay until Claude removes them.
8. Lightning / on-chain / swaps / manual refresh-exit-offboard stay unavailable; do not add
   buttons that imply they work.
9. Every string exists in both `ja.ts` and `en.ts` with the same placeholders (a test checks).
10. Respect Reduce Motion (`useReduceMotion`) and keep touch targets at 44pt or more.

## Before handing work back

```sh
cd companion && pnpm typecheck && pnpm test
```

Both must pass. Do not commit, push, or run `expo prebuild` — a push to `main` uploads a
TestFlight build. Claude runs the app in the simulator, reviews, and commits.
