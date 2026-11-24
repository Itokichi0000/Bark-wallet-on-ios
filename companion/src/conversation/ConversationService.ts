import { NoaGestures, type HandGesture } from "../../modules/noa-gestures/src";
import { useSettings } from "@/state/settingsStore";
import { useTalk } from "./talkStore";

type SpeechModule = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;

/**
 * Microphone and camera for talking with Noa. Nothing here can reach the wallet: it only
 * produces text and gesture names, which screens map to the same replies a tap would make.
 *
 * Privacy rules it keeps:
 *  - speech recognition runs on the device only (never sent to a server);
 *  - camera frames never leave native code; only gesture names come back;
 *  - both stop on screens that show secrets, in the background, and when turned off in settings;
 *  - it listens for one utterance at a time, after a deliberate trigger (palm, tapping Noa or the
 *    mic button), never continuously.
 */
export class ConversationService {
  private seq = 0;
  private speech: SpeechModule | null | undefined;
  private speechSubs: { remove(): void }[] = [];
  private offGesture: (() => void) | undefined;
  private offEyesState: (() => void) | undefined;
  private blocks = 0;
  private foreground = true;
  private cameraSuspended = false;
  private watching = false;
  /** Bumped by anything that cancels: a start begun under an older generation must not finish. */
  private earsGen = 0;
  private eyesGen = 0;
  private readonly utteranceListeners = new Set<(text: string) => void>();
  private readonly gestureListeners = new Set<(g: HandGesture) => void>();

  constructor(private readonly hooks: { beforeListening?: () => void } = {}) {}

  private module(): SpeechModule | null {
    if (this.speech === undefined) {
      try {
        this.speech = (require("expo-speech-recognition") as typeof import("expo-speech-recognition")).ExpoSpeechRecognitionModule;
      } catch {
        this.speech = null;
      }
    }
    return this.speech;
  }

  onUtterance(listener: (text: string) => void): () => void {
    this.utteranceListeners.add(listener);
    return () => this.utteranceListeners.delete(listener);
  }

  onGesture(listener: (g: HandGesture) => void): () => void {
    this.gestureListeners.add(listener);
    return () => this.gestureListeners.delete(listener);
  }

  private get blocked(): boolean {
    return this.blocks > 0 || !this.foreground;
  }

  /**
   * Screens that show the seed or restore a wallet call this with true on focus and false on blur:
   * no microphone, no camera. Calls are counted, so overlapping screens cannot unblock early.
   */
  setBlocked(blocked: boolean): void {
    this.blocks = Math.max(0, this.blocks + (blocked ? 1 : -1));
    if (this.blocked) {
      this.cancelListening();
      void this.stopEyes();
    } else {
      void this.syncEyes();
    }
  }

  /**
   * The rear QR scanner needs the camera: pause the front hand camera while it is open. Voice
   * stays available. Resolves once the hand camera has actually stopped.
   */
  async setCameraSuspended(suspended: boolean): Promise<void> {
    this.cameraSuspended = suspended;
    if (suspended) await this.stopEyes();
    else await this.syncEyes();
  }

  /** Can she listen at all on this device (on-device Japanese/English recognition)? */
  canListen(): boolean {
    const m = this.module();
    try {
      return !!m && m.isRecognitionAvailable() && m.supportsOnDeviceRecognition();
    } catch {
      return false;
    }
  }

  /** Start one listening turn. Resolves false when not allowed or not possible. */
  async listen(): Promise<boolean> {
    const s = useSettings.getState();
    if (!s.voiceInput || this.blocked) return false;
    const gen = ++this.earsGen;
    const stale = () => gen !== this.earsGen || this.blocked || !useSettings.getState().voiceInput;
    const m = this.module();
    if (!m || !this.canListen()) { useTalk.setState({ ears: "unavailable" }); return false; }
    const perm = await m.requestPermissionsAsync().catch(() => ({ granted: false }));
    if (stale()) return false;
    if (!perm.granted) { useTalk.setState({ ears: "denied" }); return false; }
    this.hooks.beforeListening?.();
    this.cancelListening();
    this.earsGen = gen;
    useTalk.setState({ ears: "listening", partial: "" });
    this.speechSubs = [
      m.addListener("speechstart", () => useTalk.setState({ ears: "hearing" })),
      m.addListener("result", (e) => {
        const text = e.results[0]?.transcript ?? "";
        if (!e.isFinal) { useTalk.setState({ ears: "hearing", partial: text }); return; }
        this.finish(text);
      }),
      m.addListener("error", () => this.finish("")),
      m.addListener("end", () => { if (useTalk.getState().ears === "listening" || useTalk.getState().ears === "hearing") this.finish(useTalk.getState().partial); }),
    ];
    try {
      m.start({
        lang: s.language === "ja" ? "ja-JP" : "en-US",
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        iosTaskHint: "confirmation",
        // Her recorded voice must still come from the speaker (not the earpiece) after listening.
        iosCategory: { category: "playAndRecord", categoryOptions: ["defaultToSpeaker", "allowBluetooth"], mode: "default" },
        contextualStrings: s.language === "ja"
          ? ["受け取る", "送る", "残高", "記録", "コイン", "ストーリー", "ガイド", "ライトニング", "コピー", "共有", "おわる", "サッツ"]
          : ["receive", "send", "balance", "history", "coins", "story", "guide", "lightning", "copy", "share", "done", "sats"],
      });
    } catch {
      this.finish("");
      return false;
    }
    return true;
  }

  /** Stop listening and use what was heard so far. */
  stopListening(): void {
    try { this.module()?.stop(); } catch { /* not running */ }
  }

  cancelListening(): void {
    this.earsGen++;
    for (const sub of this.speechSubs) sub.remove();
    this.speechSubs = [];
    try { this.module()?.abort(); } catch { /* not running */ }
    const ears = useTalk.getState().ears;
    if (ears === "listening" || ears === "hearing") useTalk.setState({ ears: "ready", partial: "" });
  }

  private finish(text: string): void {
    for (const sub of this.speechSubs) sub.remove();
    this.speechSubs = [];
    const said = this.blocked ? "" : text.trim();
    useTalk.setState({ ears: "ready", partial: "", ...(said ? { heard: { id: ++this.seq, text: said } } : {}) });
    if (said) for (const l of [...this.utteranceListeners]) l(said);
  }

  /** Turn the camera on or off to match settings, app state and the current screen. */
  async syncEyes(active = true): Promise<void> {
    const want = active && this.foreground && useSettings.getState().handGestures && !this.blocked && !this.cameraSuspended;
    if (want) await this.startEyes();
    else await this.stopEyes();
  }

  private wantEyes(): boolean {
    return this.foreground && !this.blocked && !this.cameraSuspended && useSettings.getState().handGestures;
  }

  private async startEyes(): Promise<void> {
    if (this.watching) return;
    this.watching = true;
    const gen = ++this.eyesGen;
    const supported = await NoaGestures.isSupported();
    if (gen !== this.eyesGen || !this.wantEyes()) { if (gen === this.eyesGen) this.watching = false; return; }
    if (!supported) { this.watching = false; useTalk.setState({ eyes: "unavailable" }); return; }
    this.offGesture ??= NoaGestures.onGesture((gesture) => {
      if (this.blocked || !this.watching) return;
      useTalk.setState({ gesture: { id: ++this.seq, gesture } });
      for (const l of [...this.gestureListeners]) l(gesture);
    });
    this.offEyesState ??= NoaGestures.onState((state) => {
      if (state === "watching" && this.watching) useTalk.setState({ eyes: "watching" });
      else if (state === "unavailable") useTalk.setState({ eyes: "unavailable" });
    });
    const ok = await NoaGestures.start();
    if (gen !== this.eyesGen || !this.wantEyes()) {
      // Cancelled while the camera was starting: make sure it is off again.
      await NoaGestures.stop();
      if (gen === this.eyesGen) { this.watching = false; useTalk.setState({ eyes: "off" }); }
      return;
    }
    if (!ok) { this.watching = false; useTalk.setState({ eyes: "denied" }); }
  }

  private async stopEyes(): Promise<void> {
    this.eyesGen++;
    if (!this.watching) { if (useTalk.getState().eyes === "watching") useTalk.setState({ eyes: "off" }); return; }
    this.watching = false;
    await NoaGestures.stop();
    useTalk.setState({ eyes: "off" });
  }

  /** App went to the background or came back. */
  setForeground(active: boolean): void {
    this.foreground = active;
    if (!active) this.cancelListening();
    void this.syncEyes(active);
  }
}
