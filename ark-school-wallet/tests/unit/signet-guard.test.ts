import { DEFAULT_ARK_SERVER, DEFAULT_ESPLORA, SignetGuardError, assertSignetOnlyEnv } from '../../scripts/signet-guard';
import { NetworkMismatchError, assertSignet, getSignetConfig } from '../../src/lib/bark/config';

describe('Signet-only configuration (T18)', () => {
  it('defaults to Second\'s public Signet endpoints', () => {
    expect(assertSignetOnlyEnv({})).toEqual({ arkServer: DEFAULT_ARK_SERVER, esplora: DEFAULT_ESPLORA });
    expect(getSignetConfig({}).network).toBe('Signet');
  });

  it.each([
    [{ VITE_BARK_NETWORK: 'bitcoin' }],
    [{ VITE_BARK_NETWORK: 'mainnet' }],
    [{ VITE_ARK_SERVER_URL: 'https://ark.second.tech' }],
    [{ VITE_ESPLORA_URL: 'https://mempool.second.tech/api' }],
    [{ VITE_ESPLORA_URL: 'https://mempool.space/api' }],
    [{ VITE_ARK_SERVER_URL: 'http://ark.signet.2nd.dev' }],
    [{ VITE_ARK_SERVER_URL: 'not a url' }],
  ])('rejects %o', (env) => {
    expect(() => assertSignetOnlyEnv(env)).toThrow(SignetGuardError);
  });

  it('allows localhost http for a local Signet setup', () => {
    expect(assertSignetOnlyEnv({ VITE_ARK_SERVER_URL: 'http://localhost:3535' }).arkServer).toBe('http://localhost:3535');
  });

  it('runtime: refuses anything the server reports that is not Signet', () => {
    expect(() => assertSignet('Signet')).not.toThrow();
    expect(() => assertSignet('Bitcoin')).toThrow(NetworkMismatchError);
    expect(() => assertSignet(undefined)).toThrow(NetworkMismatchError);
  });
});
