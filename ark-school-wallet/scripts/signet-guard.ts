// Build-time network guard (spec 9.1 / T18). Imported by vite.config.ts and
// unit-tested. Mainnet must never be configurable in this project.

export const DEFAULT_ARK_SERVER = 'https://ark.signet.2nd.dev';
export const DEFAULT_ESPLORA = 'https://esplora.signet.2nd.dev';

// Known mainnet endpoints from https://second.tech/docs/connection-details
const MAINNET_HOSTS = ['ark.second.tech', 'mempool.second.tech', 'mempool.space', 'blockstream.info'];

export class SignetGuardError extends Error {}

function checkUrl(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SignetGuardError(`${name} is not a valid URL: ${value}`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new SignetGuardError(`${name} must use https:// (got ${url.protocol})`);
  }
  if (MAINNET_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    throw new SignetGuardError(`${name} points at a mainnet endpoint (${url.hostname}). This app is Signet-only.`);
  }
  if (/mainnet/i.test(url.hostname)) {
    throw new SignetGuardError(`${name} looks like a mainnet endpoint (${url.href}). This app is Signet-only.`);
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

export function assertSignetOnlyEnv(env: Record<string, string | undefined>): { arkServer: string; esplora: string } {
  const network = (env.VITE_BARK_NETWORK ?? 'signet').trim().toLowerCase();
  if (network !== 'signet') {
    throw new SignetGuardError(`VITE_BARK_NETWORK must be "signet" (got "${network}"). Mainnet is not supported.`);
  }
  return {
    arkServer: checkUrl('VITE_ARK_SERVER_URL', env.VITE_ARK_SERVER_URL || DEFAULT_ARK_SERVER),
    esplora: checkUrl('VITE_ESPLORA_URL', env.VITE_ESPLORA_URL || DEFAULT_ESPLORA),
  };
}
