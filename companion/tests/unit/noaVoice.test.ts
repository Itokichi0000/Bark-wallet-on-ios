import { ja } from "@/i18n/ja";
import { NOA_VOICES, NoaVoice, VOICE_PREVIEW_LINE, hasClip } from "@/voice/NoaVoice";
import { VOICE_CLIPS } from "@/voice/voiceClips";

function fakeAudio() {
  const played: number[] = [];
  let removed = 0;
  const module = {
    createAudioPlayer: (source: number) => {
      played.push(source);
      return { play: () => undefined, remove: () => { removed += 1; }, addListener: () => undefined };
    },
    setAudioModeAsync: async () => undefined,
  };
  return { module, played, removed: () => removed };
}

describe("Noa's recorded voice", () => {
  it("only has clips for lines of the fixed catalogue, none with a value in them", () => {
    const catalogue = new Set(Object.values(ja));
    for (const voice of NOA_VOICES) {
      for (const text of Object.keys(VOICE_CLIPS[voice])) {
        expect([text, catalogue.has(text)]).toEqual([text, true]);
        expect(text).not.toMatch(/[{}]/);
      }
    }
  });

  it("has the same lines in every voice, including the preview line", () => {
    const [first, ...rest] = NOA_VOICES.map((v) => Object.keys(VOICE_CLIPS[v]).sort());
    for (const other of rest) expect(other).toEqual(first);
    if ((first ?? []).length > 0) for (const v of NOA_VOICES) expect(hasClip(v, VOICE_PREVIEW_LINE)).toBe(true);
  });

  it("stays silent for anything that was not recorded, and when off", () => {
    const audio = fakeAudio();
    const voice = new NoaVoice(() => audio.module);
    expect(voice.say("a", "abandon ability able about above absent")).toBe(false);
    expect(voice.say("a", "tark1qexampleaddress")).toBe(false);
    expect(voice.say("off", VOICE_PREVIEW_LINE)).toBe(false);
    expect(audio.played).toEqual([]);
  });

  it("never lets a playback failure escape", () => {
    const voice = new NoaVoice(() => { throw new Error("no audio"); });
    expect(() => voice.say("a", VOICE_PREVIEW_LINE)).not.toThrow();
    expect(() => voice.stop()).not.toThrow();
  });
});
