import { BackupError, decideRestore, openBackup, peekBackupHeader, sealBackup } from "@/infrastructure/backup/BackupEnvelope";

const SEED_A = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const SEED_B = "legal winner thank year wave sausage worth useful legal winner thank yellow";

let counter = 0;
const random = (n: number) => {
  // Deterministic but different on every call, which is all these tests need.
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (counter = (counter * 31 + 17) % 251);
  return out;
};
const db = new Uint8Array(4096).map((_, i) => (i * 7) % 256);
const meta = { network: "signet", fingerprint: "2377a97c", generation: 3, createdAt: "2026-01-01T00:00:00.000Z", dbFileName: "db.sqlite", sdkVersion: "0.28.0" };
const seal = (over: Partial<typeof meta> = {}, mnemonic = SEED_A) => sealBackup({ mnemonic, db, meta: { ...meta, ...over }, random });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof BackupError ? e.code : `other:${String(e)}`;
  }
  return "no-error";
};

describe("backup envelope", () => {
  it("round-trips with the right seed", () => {
    const file = seal();
    const { header, db: out } = openBackup(file, SEED_A);
    expect(Array.from(out)).toEqual(Array.from(db));
    expect(header).toMatchObject({ v: 1, network: "signet", fingerprint: "2377a97c", generation: 3, dbBytes: 4096, dbFileName: "db.sqlite" });
  });

  it("tolerates extra whitespace in the phrase", () => {
    expect(openBackup(seal(), `  ${SEED_A.replace(/ /g, "   ")} \n`).db.length).toBe(4096);
  });

  it("does not contain the database or the seed in the clear", () => {
    const file = seal();
    const text = Buffer.from(file).toString("latin1");
    expect(text).not.toContain("abandon");
    expect(Buffer.from(file).includes(Buffer.from(db.subarray(0, 32)))).toBe(false);
  });

  it("uses a fresh salt and nonce every time", () => {
    const a = seal();
    const b = seal();
    expect(peekBackupHeader(a).header.salt).not.toBe(peekBackupHeader(b).header.salt);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it("rejects the wrong seed", () => {
    expect(code(() => openBackup(seal(), SEED_B))).toBe("wrong-seed-or-tampered");
  });

  it("detects a flipped bit anywhere in the body", () => {
    const file = seal();
    const { bodyOffset } = peekBackupHeader(file);
    for (const at of [bodyOffset, bodyOffset + 30, file.length - 1]) {
      const copy = file.slice();
      copy[at] = (copy[at] ?? 0) ^ 1;
      expect(code(() => openBackup(copy, SEED_A))).toBe("wrong-seed-or-tampered");
    }
  });

  it("detects an edited header (generation, network, fingerprint are authenticated)", () => {
    const file = seal();
    const text = Buffer.from(file).toString("latin1");
    for (const [from, to] of [['"generation":3', '"generation":9'], ['"signet"', '"sIgnet"'], ["2377a97c", "2377a97d"]] as const) {
      expect(text).toContain(from);
      const edited = new Uint8Array(Buffer.from(text.replace(from, to), "latin1"));
      expect(code(() => openBackup(edited, SEED_A))).toBe("wrong-seed-or-tampered");
    }
  });

  it("binds the key to the network", () => {
    // Same seed, same salt path, but a header claiming another network cannot decrypt a signet backup.
    const file = seal({ network: "bitcoin" });
    expect(openBackup(file, SEED_A).header.network).toBe("bitcoin");
    const text = Buffer.from(file).toString("latin1").replace('"bitcoin"', '"signet"');
    expect(code(() => openBackup(new Uint8Array(Buffer.from(text, "latin1")), SEED_A))).not.toBe("no-error");
  });

  it("rejects things that are not backups", () => {
    expect(code(() => peekBackupHeader(new Uint8Array(0)))).toBe("not-a-backup");
    expect(code(() => peekBackupHeader(new TextEncoder().encode("SQLite format 3\u0000 some database bytes")))).toBe("not-a-backup");
    expect(code(() => openBackup(seal().subarray(0, 40), SEED_A))).toBe("corrupt");
  });

  it("rejects a truncated file", () => {
    const file = seal();
    expect(code(() => openBackup(file.subarray(0, file.length - 10), SEED_A))).toBe("wrong-seed-or-tampered");
  });

  it("refuses header file names that could escape the wallet directory", () => {
    for (const dbFileName of ["../db.sqlite", "a/b.sqlite", "..", ".hidden", "x\\y"]) {
      expect(code(() => peekBackupHeader(seal({ dbFileName })))).toBe("corrupt");
    }
  });
});

describe("decideRestore", () => {
  const header = peekBackupHeader(seal()).header;
  it("allows a restore into an empty signet datadir", () => {
    expect(decideRestore(header, { network: "signet" })).toEqual({ ok: true });
  });
  it("refuses another network", () => {
    expect(decideRestore({ ...header, network: "bitcoin" }, { network: "signet" })).toEqual({ ok: false, reason: "wrong-network" });
  });
  it("never overwrites an existing wallet", () => {
    expect(decideRestore(header, { network: "signet", existing: { fingerprint: "deadbeef" } })).toEqual({ ok: false, reason: "different-wallet" });
    expect(decideRestore(header, { network: "signet", existing: { fingerprint: "2377a97c", generation: 5 } })).toEqual({ ok: false, reason: "older-than-current" });
    expect(decideRestore(header, { network: "signet", existing: { fingerprint: "2377a97c", generation: 1 } })).toEqual({ ok: false, reason: "wallet-already-present" });
    expect(decideRestore(header, { network: "signet", existing: { fingerprint: "2377a97c" } })).toEqual({ ok: false, reason: "wallet-already-present" });
  });
});
