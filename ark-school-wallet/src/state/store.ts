import { create } from 'zustand';
import type { Lang } from '../i18n';
import type { DemoWallet } from '../lib/demo/DemoWallet';
import type { ScenarioName } from '../lib/demo/fixtures';
import { log } from '../lib/security/log';
import { errorMessage } from '../lib/security/redact';
import type { VaultRecord } from '../lib/security/vault';
import { readPendingSend, type PendingSend } from '../lib/wallet/reconcile';
import type { MovementView, ServerInfoView, WalletPort, WalletSnapshot } from '../lib/wallet/types';

export interface DiffRecord {
  label: 'send' | 'refresh' | 'receive';
  before: WalletSnapshot;
  after: WalletSnapshot;
  movementId?: string;
}

type Connection = 'unknown' | 'connected' | 'disconnected';

interface AppState {
  lang: Lang;
  mode: 'none' | 'demo' | 'signet';
  port: WalletPort | null;
  demo: DemoWallet | null;
  record: VaultRecord | null;
  snapshot: WalletSnapshot | null;
  history: MovementView[];
  serverInfo: ServerInfoView | undefined;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  connection: Connection;
  diff: DiffRecord | null;
  pendingSend: PendingSend | undefined;
  progress: Record<string, boolean>;

  setLang(lang: Lang): void;
  startDemo(port: DemoWallet, scenario?: ScenarioName): Promise<void>;
  openSignet(port: WalletPort, record: VaultRecord): Promise<void>;
  closeWallet(): Promise<void>;
  /** Re-read local state (no network sync). */
  reload(): Promise<void>;
  /** Network sync, then re-read. */
  sync(): Promise<WalletSnapshot | null>;
  recordDiff(d: DiffRecord): void;
  refreshPendingSend(): void;
  mark(key: string): void;
  setRecord(record: VaultRecord): void;
}

const LANG_KEY = 'ark-school:lang';
const PROGRESS_KEY = 'ark-school:progress';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* per-viewer convenience only */
  }
}

export const useApp = create<AppState>((set, get) => ({
  lang: load<Lang>(LANG_KEY, 'ja'),
  mode: 'none',
  port: null,
  demo: null,
  record: null,
  snapshot: null,
  history: [],
  serverInfo: undefined,
  lastSyncAt: null,
  syncing: false,
  syncError: null,
  connection: 'unknown',
  diff: null,
  pendingSend: undefined,
  progress: load<Record<string, boolean>>(PROGRESS_KEY, {}),

  setLang(lang) {
    save(LANG_KEY, lang);
    document.documentElement.lang = lang;
    set({ lang });
  },

  async startDemo(port, scenario) {
    if (scenario) port.loadScenario(scenario);
    await get().port?.close();
    set({ mode: 'demo', port, demo: port, record: null, diff: null, pendingSend: undefined, connection: 'connected', syncError: null });
    await get().reload();
    set({ lastSyncAt: get().snapshot?.capturedAt ?? null, serverInfo: await port.getServerInfo() });
  },

  async openSignet(port, record) {
    await get().port?.close();
    set({ mode: 'signet', port, demo: null, record, diff: null, snapshot: null, history: [], syncError: null, connection: 'unknown' });
    get().refreshPendingSend();
    try {
      set({ serverInfo: await port.getServerInfo(), connection: 'connected' });
    } catch (err) {
      log('warn', `arkInfo failed: ${errorMessage(err)}`);
      set({ connection: 'disconnected' });
    }
    await get().reload();
  },

  async closeWallet() {
    await get().port?.close();
    set({ mode: 'none', port: null, demo: null, record: null, snapshot: null, history: [], serverInfo: undefined, diff: null, lastSyncAt: null, connection: 'unknown', pendingSend: undefined });
  },

  async reload() {
    const port = get().port;
    if (!port) return;
    try {
      const [snapshot, history] = await Promise.all([port.getSnapshot(), port.getHistory()]);
      if (get().port === port) set({ snapshot, history });
    } catch (err) {
      set({ syncError: errorMessage(err) });
    }
  },

  async sync() {
    const port = get().port;
    if (!port || get().syncing) return get().snapshot;
    set({ syncing: true });
    try {
      const snapshot = await port.sync();
      const history = await port.getHistory();
      if (get().port !== port) return null;
      set({ snapshot, history, lastSyncAt: new Date().toISOString(), syncError: null, connection: 'connected' });
      return snapshot;
    } catch (err) {
      const msg = errorMessage(err);
      log('warn', `sync failed: ${msg}`);
      set({ syncError: msg, connection: 'disconnected' });
      return null;
    } finally {
      set({ syncing: false });
    }
  },

  recordDiff(d) {
    set({ diff: d });
  },

  refreshPendingSend() {
    const rec = get().record;
    set({ pendingSend: rec ? readPendingSend(rec.id) : undefined });
  },

  mark(key) {
    const progress = { ...get().progress, [key]: true };
    save(PROGRESS_KEY, progress);
    set({ progress });
  },

  setRecord(record) {
    set({ record });
  },
}));
