import { NETWORKS, type NetworkId } from "@/infrastructure/bark/barkConfig";

const STORAGE_KEY = "bcw.activeNetwork.v1";

/** Read once, synchronously, at start-up. Everything network-specific is derived from it and never changes while the app runs. */
function readActive(): NetworkId {
  try {
    const store = require("expo-secure-store") as typeof import("expo-secure-store");
    return store.getItem(STORAGE_KEY) === "mainnet" ? "mainnet" : "signet";
  } catch {
    return "signet";
  }
}

/** The network this run of the app uses. Signet unless the user has explicitly switched. */
export const ACTIVE_NETWORK: NetworkId = readActive();
export const NET = NETWORKS[ACTIVE_NETWORK];
export const IS_MAINNET = ACTIVE_NETWORK === "mainnet";

/** Storage keys and directories are namespaced by network so the two wallets can never read each other's seed, database, operations or backups. */
export const netKey = (name: string) => `bcw.${ACTIVE_NETWORK}.${name}`;

/**
 * Persist the choice and restart the JavaScript runtime. A running wallet is
 * never re-pointed at another network: the caller closes it first, and the
 * app comes back up with every module built for the new network.
 */
export async function switchNetworkAndReload(target: NetworkId): Promise<void> {
  const store = require("expo-secure-store") as typeof import("expo-secure-store");
  store.setItem(STORAGE_KEY, target);
  const { reloadAppAsync } = require("expo") as typeof import("expo");
  await reloadAppAsync("network switch");
}
