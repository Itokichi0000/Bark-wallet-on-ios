import { IS_MAINNET, netKey } from "@/config/network";
import { EventBus } from "@/domain/events";
import type { WalletAdapter } from "@/domain/wallet";
import { AvatarOrchestrator } from "@/game/AvatarOrchestrator";
import { BackupManager } from "@/infrastructure/backup/BackupManager";
import { type AuthResult, SecureSeedRepository, authenticateUser } from "@/infrastructure/secure/SecureSeedRepository";
import { PendingOperationStore } from "@/infrastructure/storage/PendingOperationStore";
import { StoryTracker } from "@/game/story";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { SyncScheduler } from "@/usecases/SyncScheduler";
import { WalletService } from "@/usecases/WalletService";

export const WALLET_MODE: "bark" | "mock" = process.env.EXPO_PUBLIC_WALLET_MODE === "mock" ? "mock" : "bark";
/** Mock build filled with pretend data and able to open a named screen at launch. Screen review only. */
const MOCK_DEMO = WALLET_MODE === "mock" && process.env.EXPO_PUBLIC_MOCK_DEMO === "1";

function createAdapter(): WalletAdapter {
  if (WALLET_MODE === "mock") {
    const { MockWalletAdapter } = require("@/infrastructure/mock/MockWalletAdapter") as typeof import("@/infrastructure/mock/MockWalletAdapter");
    return MOCK_DEMO ? new MockWalletAdapter({ initialSats: 120_000n, created: true }) : new MockWalletAdapter({ initialSats: 0n });
  }
  // Required lazily so a mock build never loads the native module.
  const { BarkWalletAdapter } = require("@/infrastructure/bark/BarkWalletAdapter") as typeof import("@/infrastructure/bark/BarkWalletAdapter");
  return new BarkWalletAdapter();
}

/**
 * Composition root. Note what is *not* wired together: the avatar and the
 * voice layer receive the event bus only. They hold no reference to the
 * adapter, the seed repository or the wallet service's send method.
 */
export const bus = new EventBus();
export const adapter = createAdapter();
export const avatar = new AvatarOrchestrator();
bus.on((e) => avatar.handle(e));

/**
 * The one device-owner check every screen uses (sending, seed reveal, network switch).
 * Policy: on Mainnet a device with no screen lock is refused. On Signet, where the
 * coins have no value, it is let through so the app stays usable on such a device
 * (and in the simulator); `unprotected` tells the screen to say so.
 */
export async function authorize(prompt: string): Promise<AuthResult | { ok: true; unprotected: true }> {
  const result = await authenticateUser(prompt).catch((): AuthResult => ({ ok: false, reason: "failed" }));
  if (!result.ok && result.reason === "not-enrolled" && !IS_MAINNET) return { ok: true, unprotected: true };
  return result;
}

const view = { get: () => useWalletStore.getState() };
/** Demo builds keep their pretend seed in memory: nothing about a review build touches the Keychain. */
function memorySeedVault(): typeof SecureSeedRepository {
  let seed: string | null = null;
  return {
    has: async () => seed !== null,
    read: async () => seed,
    store: async (m: string) => { seed = m; },
    delete: async () => { seed = null; },
  };
}
const seeds = MOCK_DEMO ? memorySeedVault() : SecureSeedRepository;

export const backup = new BackupManager(adapter, () => seeds.read(), bus, view);
export const wallet = new WalletService({
  adapter,
  bus,
  seeds,
  ops: new PendingOperationStore(undefined, netKey("pendingOps.v1")),
  backup,
  view,
  authorize,
});

/** Automatic syncing. Screens call `autoSync.watch()` while they wait for something; nobody needs a sync button. */
export const autoSync = new SyncScheduler({
  refresh: () => wallet.refresh({ background: true }),
  isOpen: () => {
    const l = useWalletStore.getState().lifecycle;
    return l === "ready" || l === "degraded";
  },
});

/**
 * Story progress follows the wallet's history. It waits for the saved progress to load,
 * so chapters already opened on this device are not announced again.
 */
export const story = new StoryTracker(
  { getSentSats: () => useSettings.getState().storySentSats, setSentSats: (v) => useSettings.getState().update({ storySentSats: v }) },
  (chapter) => bus.emit({ type: "STORY_UNLOCKED", id: bus.nextId("story"), chapter: chapter.id }),
);
function watchStory(): void {
  const observe = () => {
    const { movements, lifecycle } = useWalletStore.getState();
    if (lifecycle === "ready" || lifecycle === "degraded") story.observe(movements);
  };
  const begin = () => {
    observe();
    // A guide step newly completed (by any screen or event) is announced from here, once.
    useSettings.subscribe((s, prev) => {
      if (s.questsDone === prev.questsDone) return;
      for (const quest of Object.keys(s.questsDone)) {
        if (!prev.questsDone[quest] && quest !== "q1") bus.emit({ type: "QUEST_COMPLETED", id: bus.nextId("quest"), quest });
      }
    });
    useWalletStore.subscribe((s, prev) => (s.movements !== prev.movements || s.lifecycle !== prev.lifecycle ? observe() : undefined));
  };
  if (useSettings.persist.hasHydrated()) begin();
  else useSettings.persist.onFinishHydration(begin);
}

/** A new 12-word BIP 39 phrase. The Bark build uses the SDK's generator, as its documentation prescribes. */
export function generateMnemonic(): string {
  if (WALLET_MODE === "mock") {
    // Hermes has no crypto.getRandomValues, which @scure/bip39's own generator needs.
    const { entropyToMnemonic } = require("@scure/bip39") as typeof import("@scure/bip39");
    const { wordlist } = require("@scure/bip39/wordlists/english.js") as typeof import("@scure/bip39/wordlists/english.js");
    const { getRandomBytes } = require("expo-crypto") as typeof import("expo-crypto");
    return entropyToMnemonic(getRandomBytes(16), wordlist);
  }
  return (require("@secondts/bark-react-native") as typeof import("@secondts/bark-react-native")).generateMnemonic();
}

export function isValidMnemonic(phrase: string): boolean {
  const { validateMnemonic } = require("@scure/bip39") as typeof import("@scure/bip39");
  const { wordlist } = require("@scure/bip39/wordlists/english.js") as typeof import("@scure/bip39/wordlists/english.js");
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}

export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Start-up. In a mock build with EXPO_PUBLIC_MOCK_DEMO=1 an empty install is filled with a
 * pretend wallet and two pretend receipts, and the screen named by the `reviewRoute` launch
 * argument is returned so it can be opened directly (`simctl launch <app> -reviewRoute send`).
 * Mock only: it never runs against the real SDK, and screens stay labelled MOCK.
 */
export async function bootApp(): Promise<string | undefined> {
  try {
    const route = await start();
    watchStory();
    autoSync.start();
    return route;
  } catch (e) {
    // A start-up failure must be visible, never an endless spinner.
    useWalletStore.setState({ lifecycle: "error", fatalError: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

async function start(): Promise<string | undefined> {
  await backup.load();
  if (MOCK_DEMO) await seeds.store(generateMnemonic());
  await wallet.boot();
  if (!MOCK_DEMO) return undefined;
  const demo = adapter as unknown as { simulateIncoming(sats: bigint): unknown; simulateSent(sats: bigint): unknown };
  demo.simulateIncoming(21_000n);
  demo.simulateSent(6_000n);
  await wallet.refresh();
  const { Settings } = require("react-native") as typeof import("react-native");
  const route: unknown = Settings.get("reviewRoute");
  return typeof route === "string" && /^[a-z]+$/.test(route) ? `/${route}` : "/home";
}

/**
 * Verify and unpack an encrypted backup into place. It does not open the wallet:
 * on `ok` the screen calls `wallet.openRestored(mnemonic)` exactly once.
 */
export function restoreBackup(fileUri: string, mnemonic: string): ReturnType<typeof BackupManager.restore> {
  return BackupManager.restore(fileUri, mnemonic);
}
