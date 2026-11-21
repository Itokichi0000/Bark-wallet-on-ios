// Redaction for anything that may leave the page: diagnostics exports, error
// messages shown verbatim, the Bark log buffer (spec 9.2, T20).

const RULES: Array<[RegExp, string]> = [
  // 12–24 lowercase words in a row: very likely a BIP39 mnemonic.
  [/\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g, '[REDACTED_MNEMONIC]'],
  // Extended keys (xpub/tpub/xprv/tprv and friends).
  [/\b[xtyzuv](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,}\b/g, '[REDACTED_XKEY]'],
  // WIF private keys.
  [/\b[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, '[REDACTED_WIF]'],
  // Long hex blobs: signatures, serialized VTXOs, raw transactions, preimages.
  [/\b[0-9a-fA-F]{96,}\b/g, '[REDACTED_HEX]'],
  // Base64 blobs (PSBTs etc.).
  [/\b[A-Za-z0-9+/]{120,}={0,2}/g, '[REDACTED_BASE64]'],
];

export function redact(input: string): string {
  let out = input;
  for (const [re, label] of RULES) out = out.replace(re, label);
  return out;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return redact(err.message);
  if (typeof err === 'string') return redact(err);
  try {
    return redact(JSON.stringify(err));
  } catch {
    return 'Unknown error';
  }
}
