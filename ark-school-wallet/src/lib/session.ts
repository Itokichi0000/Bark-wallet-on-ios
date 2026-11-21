// Glue between the vault, the SDK adapter and the store. The mnemonic only
// lives in local variables here and is never put in app state.

import { openSignetWallet } from './bark/adapter';
import { NetworkMismatchError } from './bark/config';
import { DemoWallet } from './demo/DemoWallet';
import type { ScenarioName } from './demo/fixtures';
import { log } from './security/log';
import { errorMessage } from './security/redact';
import { saveRecord, sealMnemonic, unsealMnemonic, type VaultRecord } from './security/vault';
import { useApp } from '../state/store';

export type OpenFailure = 'network' | 'server' | 'wasm' | 'storage' | 'bad-passphrase' | 'generic';

export function classifyOpenError(err: unknown): OpenFailure {
  if (err instanceof NetworkMismatchError) return 'network';
  const m = errorMessage(err).toLowerCase();
  if (m.includes('bad-passphrase')) return 'bad-passphrase';
  if (m.includes('wasm') || m.includes('webassembly') || m.includes('timed out acquiring lock')) return 'wasm';
  if (m.includes('indexeddb') || m.includes('quota')) return 'storage';
  if (m.includes('connect') || m.includes('fetch') || m.includes('server') || m.includes('network') || m.includes('transport')) return 'server';
  return 'generic';
}

async function openWith(record: VaultRecord, mnemonic: string, create: boolean) {
  const res = await openSignetWallet({ walletId: record.id, barkDbName: record.barkDbName, mnemonic, create });
  await useApp.getState().openSignet(res.adapter, record);
  void useApp.getState().sync();
  return res;
}

export async function createWallet(mnemonic: string, passphrase: string, origin: VaultRecord['origin']) {
  const record = await sealMnemonic({ mnemonic, passphrase, origin });
  if (origin === 'created') record.backupConfirmed = true;
  // Open first: only persist the record once the SDK accepted the wallet.
  const res = await openWith(record, mnemonic, true);
  await saveRecord(record);
  log('info', `wallet ${origin}: ${record.id}`);
  return res;
}

export async function unlockWallet(record: VaultRecord, passphrase: string) {
  const mnemonic = await unsealMnemonic(record, passphrase);
  return openWith(record, mnemonic, false);
}

export async function startDemo(scenario: ScenarioName = 'empty') {
  await useApp.getState().startDemo(new DemoWallet(scenario), scenario);
}
