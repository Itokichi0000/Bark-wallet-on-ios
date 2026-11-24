import { requireOptionalNativeModule } from "expo-modules-core";

export type HandGesture = "wave" | "palm" | "thumbsUp" | "swipeLeft" | "swipeRight";
export type WatcherState = "watching" | "stopped" | "unavailable";

interface Subscription { remove(): void }
interface NativeGestures {
  isSupported(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<void>;
  addListener(event: "onGesture", listener: (e: { gesture: string }) => void): Subscription;
  addListener(event: "onState", listener: (e: { state: string }) => void): Subscription;
}

/** Absent in Expo Go, tests and on Android: every call then reports "not supported". */
const native = requireOptionalNativeModule<NativeGestures>("NoaGestures");
const GESTURES: readonly string[] = ["wave", "palm", "thumbsUp", "swipeLeft", "swipeRight"];

export const NoaGestures = {
  async isSupported(): Promise<boolean> {
    return native ? native.isSupported().catch(() => false) : false;
  },
  /** Asks for the camera if needed. Resolves false when it may not or cannot watch. */
  async start(): Promise<boolean> {
    return native ? native.start().catch(() => false) : false;
  },
  async stop(): Promise<void> {
    await native?.stop().catch(() => undefined);
  },
  onGesture(listener: (gesture: HandGesture) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onGesture", (e) => { if (GESTURES.includes(e.gesture)) listener(e.gesture as HandGesture); });
    return () => sub.remove();
  },
  onState(listener: (state: WatcherState) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onState", (e) => listener(e.state as WatcherState));
    return () => sub.remove();
  },
};
