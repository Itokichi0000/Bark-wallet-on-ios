// Pre-flight checks before a real wallet may be created (spec 9.5, T17).

export interface EnvironmentCheck {
  secureContext: boolean;
  webAssembly: boolean;
  indexedDb: boolean;
  webLocks: boolean;
  webCrypto: boolean;
}

export async function checkEnvironment(): Promise<EnvironmentCheck> {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext === true;
  const webAssembly = typeof WebAssembly === 'object';
  const webLocks = typeof navigator !== 'undefined' && 'locks' in navigator;
  const webCrypto = typeof crypto !== 'undefined' && typeof crypto.subtle === 'object';
  let indexedDb: boolean;
  try {
    indexedDb = await new Promise<boolean>((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(false);
      const req = indexedDB.open('ark-school-probe', 1);
      req.onsuccess = () => {
        req.result.close();
        indexedDB.deleteDatabase('ark-school-probe');
        resolve(true);
      };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  } catch {
    indexedDb = false;
  }
  return { secureContext, webAssembly, indexedDb, webLocks, webCrypto };
}

export function canCreateRealWallet(c: EnvironmentCheck): boolean {
  return c.secureContext && c.webAssembly && c.indexedDb && c.webLocks && c.webCrypto;
}

/** Ask the browser not to evict our origin's storage. Best effort; the browser may refuse. */
export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
