import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { mnemonicToSeedSync } from "@scure/bip39";

/**
 * Encrypted wallet-database backup file ("BCWB1").
 *
 *   magic(6) | headerLen(u32 BE) | header JSON | nonce(24) | ciphertext+tag
 *
 * - Key: HKDF-SHA256 over the BIP 39 seed, with a fresh random salt per file
 *   and an info string bound to this app, this purpose and the network. The
 *   backup therefore grants nothing the seed does not already grant, and a
 *   restore needs only the phrase.
 * - Cipher: XChaCha20-Poly1305 with a fresh random 24-byte nonce.
 * - The whole plaintext header is authenticated as associated data, so the
 *   network, fingerprint and generation cannot be edited without detection.
 */
const MAGIC = new Uint8Array([0x42, 0x43, 0x57, 0x42, 0x31, 0x0a]); // "BCWB1\n"
const SALT_LEN = 16;
const NONCE_LEN = 24;
const MAX_HEADER_LEN = 4096;
const INFO_PREFIX = "bark-companion-wallet/db-backup/v1/";

export interface BackupHeader {
  v: 1;
  network: string;
  /** Wallet seed fingerprint as the SDK reports it. */
  fingerprint: string;
  /** Strictly increasing per wallet; a restore prefers the highest. */
  generation: number;
  createdAt: string;
  dbFileName: string;
  dbBytes: number;
  sdkVersion: string;
  /** hex, HKDF salt */
  salt: string;
}

export type BackupErrorCode = "not-a-backup" | "unsupported-version" | "corrupt" | "wrong-seed-or-tampered";

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(code);
    this.name = "BackupError";
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string): Uint8Array {
  if (!/^([0-9a-f]{2})+$/.test(h)) throw new BackupError("corrupt");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function deriveKey(mnemonic: string, salt: Uint8Array, network: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic.trim().split(/\s+/).join(" "));
  try {
    return hkdf(sha256, seed, salt, enc.encode(INFO_PREFIX + network), 32);
  } finally {
    seed.fill(0);
  }
}

export interface SealInput {
  mnemonic: string;
  db: Uint8Array;
  meta: Omit<BackupHeader, "v" | "salt" | "dbBytes">;
  /** Cryptographically secure random bytes. */
  random: (n: number) => Uint8Array;
}

export function sealBackup({ mnemonic, db, meta, random }: SealInput): Uint8Array {
  const salt = random(SALT_LEN);
  const nonce = random(NONCE_LEN);
  if (salt.length !== SALT_LEN || nonce.length !== NONCE_LEN) throw new Error("random source returned the wrong length");
  const header: BackupHeader = { v: 1, ...meta, dbBytes: db.length, salt: toHex(salt) };
  const headerBytes = enc.encode(JSON.stringify(header));
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, headerBytes.length, false);
  const prefix = concat(MAGIC, len, headerBytes);
  const key = deriveKey(mnemonic, salt, header.network);
  try {
    const ciphertext = xchacha20poly1305(key, nonce, prefix).encrypt(db);
    return concat(prefix, nonce, ciphertext);
  } finally {
    key.fill(0);
  }
}

/** Read the (unauthenticated) header without the seed, e.g. to list backups. */
export function peekBackupHeader(file: Uint8Array): { header: BackupHeader; bodyOffset: number } {
  if (file.length < MAGIC.length + 4 || !MAGIC.every((b, i) => file[i] === b)) throw new BackupError("not-a-backup");
  const headerLen = new DataView(file.buffer, file.byteOffset + MAGIC.length, 4).getUint32(0, false);
  const start = MAGIC.length + 4;
  if (headerLen === 0 || headerLen > MAX_HEADER_LEN || file.length < start + headerLen + NONCE_LEN + 16) throw new BackupError("corrupt");
  let header: BackupHeader;
  try {
    header = JSON.parse(dec.decode(file.subarray(start, start + headerLen))) as BackupHeader;
  } catch {
    throw new BackupError("corrupt");
  }
  if (header.v !== 1) throw new BackupError("unsupported-version");
  if (
    typeof header.network !== "string" || typeof header.fingerprint !== "string" ||
    !Number.isSafeInteger(header.generation) || header.generation < 1 ||
    typeof header.salt !== "string" || typeof header.dbFileName !== "string" ||
    /[\\/]/.test(header.dbFileName) || header.dbFileName.startsWith(".")
  ) {
    throw new BackupError("corrupt");
  }
  return { header, bodyOffset: start + headerLen };
}

/** Decrypt and authenticate. Throws `wrong-seed-or-tampered` if either the seed or any byte is wrong. */
export function openBackup(file: Uint8Array, mnemonic: string): { header: BackupHeader; db: Uint8Array } {
  const { header, bodyOffset } = peekBackupHeader(file);
  const prefix = file.subarray(0, bodyOffset);
  const nonce = file.subarray(bodyOffset, bodyOffset + NONCE_LEN);
  const ciphertext = file.subarray(bodyOffset + NONCE_LEN);
  const key = deriveKey(mnemonic, fromHex(header.salt), header.network);
  let db: Uint8Array;
  try {
    db = xchacha20poly1305(key, nonce, prefix).decrypt(ciphertext);
  } catch {
    throw new BackupError("wrong-seed-or-tampered");
  } finally {
    key.fill(0);
  }
  if (db.length !== header.dbBytes) throw new BackupError("corrupt");
  return { header, db };
}

export type RestoreDecision =
  | { ok: true }
  | { ok: false; reason: "wrong-network" | "wallet-already-present" | "older-than-current" | "different-wallet" };

/**
 * Whether a decrypted backup may be written into the datadir. A backup never
 * silently replaces a wallet: restoring over an existing database is refused
 * outright (the caller must first move the wallet away on purpose).
 */
export function decideRestore(
  header: BackupHeader,
  target: { network: string; existing?: { fingerprint: string; generation?: number } },
): RestoreDecision {
  if (header.network !== target.network) return { ok: false, reason: "wrong-network" };
  if (target.existing) {
    if (target.existing.fingerprint !== header.fingerprint) return { ok: false, reason: "different-wallet" };
    if (target.existing.generation !== undefined && header.generation < target.existing.generation) {
      return { ok: false, reason: "older-than-current" };
    }
    return { ok: false, reason: "wallet-already-present" };
  }
  return { ok: true };
}
