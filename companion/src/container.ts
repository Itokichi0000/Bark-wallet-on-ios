import { IS_MAINNET, netKey } from "@/config/network";
import { EventBus } from "@/domain/events";
import type { WalletAdapter } from "@/domain/wallet";
import { AvatarOrchestrator } from "@/game/AvatarOrchestrator";
import { BackupManager } from "@/infrastructure/backup/BackupManager";
import { type AuthResult, SecureSeedRepository, authenticateUser } from "@/infrastructure/secure/SecureSeedRepository";
import { PendingOperationStore } from "@/infrastructure/storage/PendingOperationStore";
import { useWalletStore } from "@/state/walletStore";
import { WalletService } from "@/usecases/WalletService";

export const WALLET_MODE: "bark" | "mock" = process.env.EXPO_PUBLIC_WALLET_MODE === "mock" ? "mock" : "bark";

function createAdapter(): WalletAdapter {
  if (WALLET_MODE === "mock") {
    const { MockWalletAdapter } = require("@/infrastructure/mock/MockWalletAdapter") as typeof import("@/infrastructure/mock/MockWalletAdapter");
    return new MockWalletAdapter({ initialSats: 0n });
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
export const backup = new BackupManager(adapter, () => SecureSeedRepository.read(), bus, view);
export const wallet = new WalletService({
  adapter,
  bus,
  seeds: SecureSeedRepository,
  ops: new PendingOperationStore(undefined, netKey("pendingOps.v1")),
  backup,
  view,
  authorize,
});

/** A new 12-word BIP 39 phrase. The Bark build uses the SDK's generator, as its documentation prescribes. */
export function generateMnemonic(): string {
  if (WALLET_MODE === "mock") {
    const { generateMnemonic: gen } = require("@scure/bip39") as typeof import("@scure/bip39");
    const { wordlist } = require("@scure/bip39/wordlists/english.js") as typeof import("@scure/bip39/wordlists/english.js");
    return gen(wordlist, 128);
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
