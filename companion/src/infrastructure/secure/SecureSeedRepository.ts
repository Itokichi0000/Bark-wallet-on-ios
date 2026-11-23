import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SEED_KEY = "bcw.signet.seed.v1";

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Keychain / Keystore, readable only while unlocked, never migrated to another device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * The only place the mnemonic is persisted. It is never written to a file,
 * AsyncStorage, a log line, the clipboard or a store that devtools can read.
 */
export const SecureSeedRepository = {
  async has(): Promise<boolean> {
    return (await SecureStore.getItemAsync(SEED_KEY, OPTIONS)) !== null;
  },

  /** For opening the wallet. Callers must not keep the value in React state. */
  async read(): Promise<string | null> {
    return SecureStore.getItemAsync(SEED_KEY, OPTIONS);
  },

  /** Refuses to overwrite: replacing a seed is how funds get lost. */
  async store(mnemonic: string): Promise<void> {
    if (await this.has()) throw new Error("A seed is already stored; delete the wallet explicitly first.");
    await SecureStore.setItemAsync(SEED_KEY, mnemonic, OPTIONS);
  },

  async delete(): Promise<void> {
    await SecureStore.deleteItemAsync(SEED_KEY, OPTIONS);
  },
};

export type AuthResult = { ok: true } | { ok: false; reason: "cancelled" | "not-enrolled" | "failed" };

/**
 * Ask the device owner to prove presence (biometrics or device passcode).
 * A device with no lock at all cannot authenticate; callers decide what to
 * do with `not-enrolled` and must say so on screen.
 */
export async function authenticateUser(promptMessage: string): Promise<AuthResult> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return { ok: false, reason: "not-enrolled" };
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
  if (result.success) return { ok: true };
  const cancelled = result.error === "user_cancel" || result.error === "system_cancel" || result.error === "app_cancel";
  return { ok: false, reason: cancelled ? "cancelled" : "failed" };
}
