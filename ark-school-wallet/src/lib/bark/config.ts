import { assertSignetOnlyEnv } from '../../../scripts/signet-guard';

// Signet is hard-wired (spec 9.1). There is deliberately no network switch.
export const NETWORK = 'Signet' as const;

export interface SignetConfig {
  network: typeof NETWORK;
  serverAddress: string;
  esploraAddress: string;
  faucetUrl: string;
}

let cached: SignetConfig | undefined;

/** Runtime config; the same guard also runs at build time in vite.config.ts. */
export function getSignetConfig(env: Record<string, string | undefined> = import.meta.env): SignetConfig {
  if (cached && env === import.meta.env) return cached;
  const { arkServer, esplora } = assertSignetOnlyEnv(env);
  const cfg: SignetConfig = {
    network: NETWORK,
    serverAddress: arkServer,
    esploraAddress: esplora,
    faucetUrl: 'https://signet.2nd.dev/',
  };
  if (env === import.meta.env) cached = cfg;
  return cfg;
}

export class NetworkMismatchError extends Error {
  constructor(public reported: string) {
    super(`Ark server reports network "${reported}", expected Signet. Refusing to continue.`);
  }
}

/** Runtime check against what the SDK/server actually report. */
export function assertSignet(reported: string | undefined): void {
  if (reported !== NETWORK) throw new NetworkMismatchError(String(reported));
}
