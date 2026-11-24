import { VOICE_CLIPS } from "./voiceClips";

export type NoaVoiceId = "a" | "b" | "c";
export type NoaVoiceSetting = NoaVoiceId | "off";
export const NOA_VOICES: readonly NoaVoiceId[] = ["a", "b", "c"];

/** Shown in the voice picker, and what the preview button plays. */
export const VOICE_PREVIEW_LINE = "おつかれさま。何か手伝おうか？";

interface Player {
  play(): void;
  remove(): void;
  addListener(event: "playbackStatusUpdate", listener: (status: { didJustFinish?: boolean }) => void): unknown;
}
interface AudioModule {
  createAudioPlayer(source: number): Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean }): Promise<void>;
}

/** Whether this exact line was recorded for this voice. Lines with amounts or other values in them never are. */
export function hasClip(voice: NoaVoiceId, text: string): boolean {
  return VOICE_CLIPS[voice][text] !== undefined;
}

/**
 * Noa's recorded voice. It can only play clips recorded in advance from the fixed line
 * catalogue: it is given no text to synthesise, so nothing typed, scanned or secret (an
 * address, an amount, the seed) can ever be spoken by it. It follows the silent switch.
 */
export class NoaVoice {
  private current: Player | undefined;
  private audio: AudioModule | undefined;

  constructor(private readonly load: () => AudioModule = () => require("expo-audio") as AudioModule) {}

  /** Plays the clip for this line. Returns false, and stays silent, when there is none. */
  say(voice: NoaVoiceSetting, text: string): boolean {
    this.stop();
    if (voice === "off") return false;
    const clip = VOICE_CLIPS[voice][text];
    if (clip === undefined) return false;
    try {
      if (!this.audio) {
        this.audio = this.load();
        void this.audio.setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined);
      }
      const player = this.audio.createAudioPlayer(clip);
      this.current = player;
      player.addListener("playbackStatusUpdate", (status) => {
        if (!status.didJustFinish) return;
        if (this.current === player) this.current = undefined;
        try { player.remove(); } catch { /* already released */ }
      });
      player.play();
      return true;
    } catch {
      // Sound is decoration: a failure to play must never disturb the wallet.
      this.current = undefined;
      return false;
    }
  }

  stop(): void {
    const player = this.current;
    this.current = undefined;
    if (!player) return;
    try { player.remove(); } catch { /* already released */ }
  }
}

export const noaVoice = new NoaVoice();
