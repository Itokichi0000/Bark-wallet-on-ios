import { VaultError, deleteRecord, getRecord, listRecords, saveRecord, sealMnemonic, unsealMnemonic } from '../../src/lib/security/vault';

const M = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('vault (encrypted recovery phrase)', () => {
  it('round-trips with the right passphrase only', async () => {
    const rec = await sealMnemonic({ mnemonic: M, passphrase: 'correct horse', origin: 'created', iterations: 1_000 });
    expect(JSON.stringify(rec)).not.toContain('abandon');
    expect(rec.barkDbName).toMatch(/^ark-school-signet-[0-9a-f]{16}$/);
    expect(await unsealMnemonic(rec, 'correct horse')).toBe(M);
    await expect(unsealMnemonic(rec, 'wrong horse')).rejects.toBeInstanceOf(VaultError);
  });

  it('rejects short passphrases', async () => {
    await expect(sealMnemonic({ mnemonic: M, passphrase: 'short', origin: 'created', iterations: 1_000 })).rejects.toThrow(/weak/);
  });

  it('stores records in IndexedDB', async () => {
    const rec = await sealMnemonic({ mnemonic: M, passphrase: 'correct horse', origin: 'restored', iterations: 1_000 });
    await saveRecord(rec);
    expect((await listRecords()).map((r) => r.id)).toContain(rec.id);
    expect((await getRecord(rec.id))?.cipher.data).toBe(rec.cipher.data);
    await deleteRecord(rec.id);
    expect(await getRecord(rec.id)).toBeUndefined();
  });
});
