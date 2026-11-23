export type NetworkId = "signet" | "mainnet";

export interface NetworkConfig {
  network: NetworkId;
  serverAddress: string;
  esploraAddress: string;
  faucetUrl?: string;
  datadirName: string;
  addressPrefix: string;
}

/**
 * Endpoints from https://second.tech/docs/connection-details. This is the only
 * place mainnet values appear. Which entry is used is decided once at start-up
 * in src/config/network.ts; Signet is the default.
 */
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  signet: {
    network: "signet",
    serverAddress: "https://ark.signet.2nd.dev",
    esploraAddress: "https://esplora.signet.2nd.dev",
    faucetUrl: "https://signet.2nd.dev/",
    datadirName: "bark-signet",
    addressPrefix: "tark1",
  },
  mainnet: {
    network: "mainnet",
    serverAddress: "https://ark.second.tech",
    esploraAddress: "https://mempool.second.tech/api",
    datadirName: "bark-mainnet",
    addressPrefix: "ark1",
  },
};
export const SIGNET = NETWORKS.signet;

/** Must match the installed @secondts/bark-react-native; a unit test checks it. */
export const BARK_SDK_VERSION = "0.28.0";

/** App heuristic for "worth mentioning": about three days of blocks. The SDK decides what is *required*. */
export const REFRESH_SOON_BLOCKS = 432;
export const EXPIRY_URGENT_BLOCKS = 144;
