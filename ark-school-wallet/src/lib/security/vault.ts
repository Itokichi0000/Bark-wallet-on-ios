// Passphrase-encrypted storage of the recovery phrase.
//
// The Bark WASM SDK needs the mnemonic every time the wallet is opened, and it
// does not store it for us. We never put the mnemonic in localStorage, URLs or
// logs (spec 9.2). Instead it is encrypted with AES-GCM under a key derived
// from a user passphrase (PBKDF2-SHA256) and the ciphertext is kept in
// IndexedDB. This protects against casual disk access, NOT against XSS or a
// compromised page while the wallet is unlocked. See docs/SECURITY_REVIEW.md.

const DB_NAME = 'ark-school-vault';
const STORE = 'wallets';
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 8;

export interface VaultRecord {
  id: string;
  /** IndexedDB name the Bark SDK uses for this wallet's database. */
  barkDbName: string;
  network: 'signet';
  createdAt: string;
  origin: 'created' | 'restored';
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string; data: string };
  /** The user went through the "write the words down" confirmation. */
  backupConfirmed: boolean;
}

export class VaultError extends Error {
  constructor(public code: 'bad-passphrase' | 'not-found' | 'storage' | 'weak-passphrase', message?: string) {
    super(message ?? code);
  }
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new VaultError('storage', req.error?.message));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(new VaultError('storage', t.error?.message));
      t.onabort = () => reject(new VaultError('storage', t.error?.message));
    });
  } finally {
    db.close();
  }
}

export function newWalletId(): string {
  return Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sealMnemonic(args: {
  mnemonic: string;
  passphrase: string;
  origin: VaultRecord['origin'];
  iterations?: number;
}): Promise<VaultRecord> {
  if (args.passphrase.length < MIN_PASSPHRASE_LENGTH) throw new VaultError('weak-passphrase');
  const iterations = args.iterations ?? PBKDF2_ITERATIONS;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(args.passphrase, salt, iterations);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(args.mnemonic)));
  const id = newWalletId();
  return {
    id,
    barkDbName: `ark-school-signet-${id}`,
    network: 'signet',
    createdAt: new Date().toISOString(),
    origin: args.origin,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv), data: b64(data) },
    backupConfirmed: false,
  };
}

export async function unsealMnemonic(record: VaultRecord, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, unb64(record.kdf.salt), record.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(record.cipher.iv) }, key, unb64(record.cipher.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new VaultError('bad-passphrase');
  }
}

export async function saveRecord(record: VaultRecord): Promise<void> {
  await tx('readwrite', (s) => s.put(record));
}

export async function listRecords(): Promise<VaultRecord[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<VaultRecord[]>);
}

export async function getRecord(id: string): Promise<VaultRecord | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<VaultRecord | undefined>);
}

export async function deleteRecord(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new VaultError('storage', req.error?.message));
    req.onblocked = () => resolve();
  });
}

/** Removes the encrypted phrase AND the Bark wallet databases for this record. */
export async function destroyWallet(record: VaultRecord): Promise<void> {
  await deleteIdb(record.barkDbName);
  await deleteIdb(`${record.barkDbName}-onchain`);
  await deleteRecord(record.id);
}
