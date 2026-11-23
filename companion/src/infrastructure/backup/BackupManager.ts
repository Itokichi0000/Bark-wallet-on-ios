import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRandomBytes } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { errorMessage } from "@/domain/errors";
import type { EventBus } from "@/domain/events";
import type { WalletAdapter } from "@/domain/wallet";
import type { BackupView, WalletView } from "@/state/walletStore";
import { SIGNET } from "../bark/barkConfig";
import { BackupError, type BackupHeader, decideRestore, openBackup, peekBackupHeader, sealBackup } from "./BackupEnvelope";

/** Loaded lazily so a mock build never touches the native module. */
const sdk = () => require("@secondts/bark-react-native") as typeof import("@secondts/bark-react-native");

const META_KEY = "bcw.signet.backupMeta.v1";
const BACKUP_DIR = "backups";
const KEEP_GENERATIONS = 5;
const DEBOUNCE_MS = 1500;

interface Meta {
  generation: number;
  lastSuccessAt?: string;
  exportedGeneration: number;
}

export type RestoreResult =
  | { ok: true; header: BackupHeader }
  | { ok: false; reason: BackupError["code"] | "wrong-network" | "wallet-already-present" | "older-than-current" | "different-wallet" | "verify-failed" | "io"; detail?: string };

/**
 * Continuous, encrypted backups of the Bark database (design doc 9.3).
 *
 * A snapshot is taken after every wallet state change, not on a timer: the
 * daemon is stopped, the database file is copied while nothing writes to
 * it, and the daemon is started again. The copy is sealed with a key
 * derived from the seed and written with a generation number.
 *
 * Backups written here still live on this device. They only protect against
 * losing the device once the user exports one (`exportLatest`), and the UI
 * says so until that has happened for the newest generation.
 */
export class BackupManager {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private dirty = false;

  constructor(
    private readonly adapter: WalletAdapter,
    private readonly readSeed: () => Promise<string | null>,
    private readonly bus: EventBus,
    private readonly view: { get(): WalletView },
  ) {}

  private dir(): Directory {
    return new Directory(Paths.document, BACKUP_DIR);
  }

  private async meta(): Promise<Meta> {
    try {
      const raw = await AsyncStorage.getItem(META_KEY);
      if (raw) return JSON.parse(raw) as Meta;
    } catch {
      // fall through to a fresh record
    }
    return { generation: 0, exportedGeneration: 0 };
  }

  private patch(p: Partial<BackupView>): void {
    const v = this.view.get();
    v.set({ backup: { ...v.backup, ...p } });
  }

  async load(): Promise<void> {
    if (this.adapter.isMock) {
      this.patch({ status: "unsupported" });
      return;
    }
    const m = await this.meta();
    this.patch({
      generation: m.generation,
      lastSuccessAt: m.lastSuccessAt,
      exportedGeneration: m.exportedGeneration,
      status: m.generation === 0 ? "never" : "current",
    });
  }

  /** Called after every wallet state change. Coalesces bursts; never throws. */
  stateChanged(_reason: string): void {
    if (this.adapter.isMock) return;
    this.dirty = true;
    const status = this.view.get().backup.status;
    this.patch({ status: status === "never" ? "never" : "pending" });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.backupNow();
    }, DEBOUNCE_MS);
  }

  backupNow(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.dirty) this.stateChanged("coalesced");
    });
    return this.running;
  }

  private async run(): Promise<void> {
    this.dirty = false;
    try {
      const mnemonic = await this.readSeed();
      if (!mnemonic) throw new Error("seed unavailable");
      const info = await this.adapter.info();
      const m = await this.meta();
      const generation = m.generation + 1;

      const { bytes, name } = await this.adapter.quiesce(async (dbFile) => {
        const file = new File(dbFile.startsWith("file://") ? dbFile : `file://${dbFile}`);
        // A hot journal or WAL beside the database means a plain copy would not be a consistent snapshot.
        for (const suffix of ["-journal", "-wal"]) {
          const side = new File(`${file.uri}${suffix}`);
          if (side.exists && side.size > 0) throw new Error(`database has an open ${suffix.slice(1)}; not copying`);
        }
        return { bytes: await file.bytes(), name: file.name };
      });

      const sealed = sealBackup({
        mnemonic,
        db: bytes,
        meta: {
          network: info.network, fingerprint: info.fingerprint, generation,
          createdAt: new Date().toISOString(), dbFileName: name, sdkVersion: info.sdkVersion,
        },
        random: (n) => getRandomBytes(n),
      });
      // Prove the file we are about to rely on can actually be opened with this seed.
      openBackup(sealed, mnemonic);

      const dir = this.dir();
      if (!dir.exists) dir.create({ intermediates: true });
      const out = new File(dir, `bcw-${info.fingerprint}-${String(generation).padStart(6, "0")}.bcwb`);
      if (out.exists) out.delete();
      out.create();
      out.write(sealed);
      this.prune(info.fingerprint);

      const next: Meta = { generation, lastSuccessAt: new Date().toISOString(), exportedGeneration: m.exportedGeneration };
      await AsyncStorage.setItem(META_KEY, JSON.stringify(next));
      this.patch({ status: this.dirty ? "pending" : "current", generation, lastSuccessAt: next.lastSuccessAt, lastError: undefined });
    } catch (e) {
      this.patch({ status: "failed", lastError: errorMessage(e) });
      this.bus.emit({ type: "BACKUP_FAILED", id: this.bus.nextId("backup") });
    }
  }

  private prune(fingerprint: string): void {
    const files = this.dir()
      .list()
      .filter((f): f is File => f instanceof File && f.name.startsWith(`bcw-${fingerprint}-`) && f.name.endsWith(".bcwb"))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
    for (const old of files.slice(KEEP_GENERATIONS)) old.delete();
  }

  private latestFile(): File | undefined {
    const dir = this.dir();
    if (!dir.exists) return undefined;
    return dir
      .list()
      .filter((f): f is File => f instanceof File && f.name.endsWith(".bcwb"))
      .sort((a, b) => (a.name < b.name ? 1 : -1))[0];
  }

  /** Hand the newest backup to the OS share sheet so it can leave the device (Files, iCloud Drive, ...). */
  async exportLatest(): Promise<boolean> {
    const file = this.latestFile();
    if (!file || !(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: "application/octet-stream", dialogTitle: file.name });
    const m = await this.meta();
    // The share sheet does not report where the file went, so this records "offered", shown as such.
    const next: Meta = { ...m, exportedGeneration: m.generation };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(next));
    this.patch({ exportedGeneration: next.exportedGeneration });
    return true;
  }

  /**
   * Decrypt a backup with the given seed and put its database in place.
   * Only ever writes into an empty wallet directory, and removes what it
   * wrote if the result does not check out.
   */
  static async restore(fileUri: string, mnemonic: string): Promise<RestoreResult> {
    let bytes: Uint8Array;
    try {
      bytes = await new File(fileUri).bytes();
    } catch (e) {
      return { ok: false, reason: "io", detail: errorMessage(e) };
    }
    let opened: ReturnType<typeof openBackup>;
    try {
      peekBackupHeader(bytes);
      opened = openBackup(bytes, mnemonic);
    } catch (e) {
      if (e instanceof BackupError) return { ok: false, reason: e.code };
      return { ok: false, reason: "corrupt", detail: errorMessage(e) };
    }
    const { readDatadirInfo, walletExists, Network } = sdk();
    const datadir = new Directory(Paths.document, SIGNET.datadirName);
    const existingInfo = datadir.exists && walletExists(datadir.uri) ? readDatadirInfo(datadir.uri) : undefined;
    const decision = decideRestore(opened.header, {
      network: SIGNET.network,
      existing: existingInfo ? { fingerprint: existingInfo.fingerprint } : undefined,
    });
    if (!decision.ok) return { ok: false, reason: decision.reason };

    const target = new File(datadir, opened.header.dbFileName);
    try {
      if (!datadir.exists) datadir.create({ intermediates: true });
      if (target.exists) return { ok: false, reason: "wallet-already-present" };
      target.create();
      target.write(opened.db);
      const info = readDatadirInfo(datadir.uri);
      if (!info || info.fingerprint !== opened.header.fingerprint || info.network !== Network.Signet) {
        target.delete();
        return { ok: false, reason: "verify-failed" };
      }
    } catch (e) {
      if (target.exists) target.delete();
      return { ok: false, reason: "io", detail: errorMessage(e) };
    }
    // Continue numbering after the restored generation so a later backup is never mistaken for an older one.
    await AsyncStorage.setItem(META_KEY, JSON.stringify({ generation: opened.header.generation, exportedGeneration: opened.header.generation, lastSuccessAt: opened.header.createdAt } satisfies Meta));
    return { ok: true, header: opened.header };
  }
}
