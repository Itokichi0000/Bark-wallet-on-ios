import { ConversationService } from "@/conversation/ConversationService";
import { useTalk } from "@/conversation/talkStore";
import { useSettings } from "@/state/settingsStore";

type Listener = (e: any) => void;
const mockListeners = new Map<string, Listener>();
let mockResolvePerm: ((v: { granted: boolean }) => void) | undefined;
const mockSpeech = {
  isRecognitionAvailable: () => true,
  supportsOnDeviceRecognition: () => true,
  requestPermissionsAsync: () => new Promise<{ granted: boolean }>((r) => { mockResolvePerm = r; }),
  addListener: (name: string, l: Listener) => { mockListeners.set(name, l); return { remove: () => mockListeners.delete(name) }; },
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};
jest.mock("expo-speech-recognition", () => ({ ExpoSpeechRecognitionModule: mockSpeech }));

describe("conversation sensors", () => {
  beforeEach(() => {
    mockListeners.clear();
    mockSpeech.start.mockClear();
    useSettings.setState({ voiceInput: true, handGestures: false });
    useTalk.setState({ ears: "off", partial: "", heard: undefined });
  });

  it("hears one utterance and passes it on", async () => {
    const c = new ConversationService();
    const heard: string[] = [];
    c.onUtterance((t) => heard.push(t));
    const started = c.listen();
    mockResolvePerm?.({ granted: true });
    expect(await started).toBe(true);
    mockListeners.get("result")?.({ isFinal: false, results: [{ transcript: "残" }] });
    expect(useTalk.getState().partial).toBe("残");
    mockListeners.get("result")?.({ isFinal: true, results: [{ transcript: "残高は？" }] });
    expect(heard).toEqual(["残高は？"]);
    expect(useTalk.getState().ears).toBe("ready");
  });

  it("a secret screen opened while the permission prompt is up wins: nothing starts", async () => {
    const c = new ConversationService();
    const started = c.listen();
    c.setBlocked(true);
    mockResolvePerm?.({ granted: true });
    expect(await started).toBe(false);
    expect(mockSpeech.start).not.toHaveBeenCalled();
  });

  it("going to the background cancels a pending start", async () => {
    const c = new ConversationService();
    const started = c.listen();
    c.setForeground(false);
    mockResolvePerm?.({ granted: true });
    expect(await started).toBe(false);
    expect(mockSpeech.start).not.toHaveBeenCalled();
  });

  it("blocks are counted, and nothing is heard while blocked", async () => {
    const c = new ConversationService();
    c.setBlocked(true);
    c.setBlocked(true);
    c.setBlocked(false);
    expect(await c.listen()).toBe(false);
    c.setBlocked(false);
    const started = c.listen();
    mockResolvePerm?.({ granted: true });
    expect(await started).toBe(true);
  });

  it("does not listen when voice is turned off", async () => {
    useSettings.setState({ voiceInput: false });
    expect(await new ConversationService().listen()).toBe(false);
  });
});
