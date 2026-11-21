import { clearLogs, exportDiagnostics, getLogs, log } from '../../src/lib/security/log';
import { errorMessage, redact } from '../../src/lib/security/redact';

const MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('redaction (T20)', () => {
  beforeEach(() => clearLogs());

  it('removes mnemonics, extended keys and long hex', () => {
    const tpub = 'tpubD6NzVbkrYhZ4XgiXtGrdW5XDAPFCL9h7we1vwNCpn8tGbBcgfVYjXyhWo4E1xkh56hjod1RhGjxbaTLV3X4FyWuejifB9jusQ46QzG87VKp';
    const out = redact(`seed=${MNEMONIC} key=${tpub} tx=${'ab'.repeat(80)}`);
    expect(out).not.toContain('abandon');
    expect(out).not.toContain(tpub);
    expect(out).toContain('[REDACTED_MNEMONIC]');
    expect(out).toContain('[REDACTED_XKEY]');
    expect(out).toContain('[REDACTED_HEX]');
  });

  it('keeps ordinary messages readable', () => {
    expect(redact('handshake request failed: invalid x-user-agent')).toBe('handshake request failed: invalid x-user-agent');
  });

  it('log buffer and diagnostics never contain the mnemonic', () => {
    log('error', `failed to open with ${MNEMONIC}`);
    expect(getLogs()[0]!.message).not.toContain('abandon');
    const diag = exportDiagnostics({ note: MNEMONIC });
    expect(diag).not.toContain('abandon ability');
    expect(errorMessage(new Error(MNEMONIC))).toBe('[REDACTED_MNEMONIC]');
  });
});
