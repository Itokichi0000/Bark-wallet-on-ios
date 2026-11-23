/** Signet endpoints from https://second.tech/docs/connection-details. No mainnet values exist in this app. */
export const SIGNET = {
  network: "signet" as const,
  serverAddress: "https://ark.signet.2nd.dev",
  esploraAddress: "https://esplora.signet.2nd.dev",
  faucetUrl: "https://signet.2nd.dev/",
  datadirName: "bark-signet",
};

/** Must match the installed @secondts/bark-react-native; a unit test checks it. */
export const BARK_SDK_VERSION = "0.28.0";

/** App heuristic for "worth mentioning": about three days of blocks. The SDK decides what is *required*. */
export const REFRESH_SOON_BLOCKS = 432;
export const EXPIRY_URGENT_BLOCKS = 144;
