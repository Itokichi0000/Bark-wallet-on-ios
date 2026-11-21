// Loads the Bark WebAssembly SDK exactly once (docs: "share one init promise").
// Imported lazily so Demo mode never downloads or runs the WASM.

import { log } from '../security/log';

export type BarkModule = typeof import('@secondts/bark/web');

let modulePromise: Promise<BarkModule> | undefined;

export function loadBark(): Promise<BarkModule> {
  modulePromise ??= (async () => {
    const mod = await import('@secondts/bark/web');
    const { default: wasmUrl } = await import('@secondts/bark/web/bark_ffi_wasm_bg.wasm?url');
    await mod.default({ module_or_path: wasmUrl });
    // Route Bark's own log records into our redacted in-memory buffer instead of the console.
    mod.setLogger({ log: (level, target, message) => log(normalizeLevel(level), `${target}: ${message}`, 'bark') }, 'info');
    return mod;
  })().catch((err) => {
    modulePromise = undefined;
    throw err;
  });
  return modulePromise;
}

function normalizeLevel(level: string): 'error' | 'warn' | 'info' | 'debug' | 'trace' {
  const l = level.toLowerCase();
  return l === 'error' || l === 'warn' || l === 'debug' || l === 'trace' ? l : 'info';
}
