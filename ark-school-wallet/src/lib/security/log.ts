import { redact } from './redact';

// In-memory, redacted ring buffer. The app never uses console.* directly
// (enforced by eslint no-console) and never ships logs anywhere.

export interface LogEntry {
  at: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  source: 'app' | 'bark';
  message: string;
}

const MAX = 400;
const buffer: LogEntry[] = [];

export function log(level: LogEntry['level'], message: string, source: LogEntry['source'] = 'app'): void {
  buffer.push({ at: new Date().toISOString(), level, source, message: redact(message) });
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

export function getLogs(): readonly LogEntry[] {
  return buffer;
}

export function clearLogs(): void {
  buffer.length = 0;
}

/** Diagnostics text for a support request. Everything is redacted again on the way out. */
export function exportDiagnostics(extra: Record<string, unknown>): string {
  const body = {
    app: 'ark-school-wallet',
    network: 'signet',
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
    ...extra,
    logs: buffer,
  };
  return redact(JSON.stringify(body, null, 2));
}
