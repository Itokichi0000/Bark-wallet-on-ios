export type WalletErrorCode =
  | "not-open"
  | "already-exists"
  | "no-wallet"
  | "seed-missing"
  | "native-module-missing"
  | "quote-unavailable"
  | "insufficient-funds"
  | "sdk";

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  constructor(code: WalletErrorCode, message?: string) {
    super(message ?? code);
    this.name = "WalletError";
    this.code = code;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
