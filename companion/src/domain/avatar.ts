export type AvatarEmotion =
  | "neutral" | "happy" | "curious" | "thinking"
  | "focused" | "surprised" | "sleepy" | "concerned";

export type AvatarAction =
  | "idle" | "blink" | "float" | "wave" | "point-left" | "point-right"
  | "listen" | "speak" | "inspect" | "prepare-send"
  | "sending" | "receive" | "celebrate" | "warn" | "rest"
  // Gestures added with the per-action motion clips.
  | "think" | "nod" | "point-down" | "hush" | "yawn" | "startle" | "talk" | "search"
  // Idle life only (IdleDirector): never carry a line or a meaning.
  | "sway" | "hairfix" | "peek"
  /** She holds up her board; the screen draws a QR code or the camera view on it. Stays until replaced. */
  | "present"
  /** Confirmed incoming payment only: she catches it. Emitted for PAYMENT_RECEIVED and nothing else. */
  | "catch";

export interface AvatarCue {
  id: string;
  emotion: AvatarEmotion;
  action: AvatarAction;
  /** i18n key of the line in the speech bubble. */
  lineKey?: string;
  /** Values substituted into the line. Never secrets: only what the screen already shows. */
  lineParams?: Record<string, string>;
  soundKey?: string;
  priority: number;
  interruptible: boolean;
  /** Domain event that caused this cue; the same eventId is never played twice. */
  eventId?: string;
  /** How long the cue holds before the avatar returns to idle. 0 = until replaced. */
  holdMs: number;
}

/** Higher wins. Order from design doc 4.2. */
export const CuePriority = {
  idle: 0,
  /** Entering a screen: her standing guidance for that screen. */
  scene: 5,
  menu: 10,
  /** A small reaction to something the user just did (copied, scanned, toggled). */
  reaction: 12,
  story: 15,
  voice: 20,
  sendInput: 30,
  mistake: 40,
  paymentResult: 50,
  safety: 60,
} as const;

export const IDLE_CUE: AvatarCue = {
  id: "idle",
  emotion: "neutral",
  action: "idle",
  priority: CuePriority.idle,
  interruptible: true,
  holdMs: 0,
};
