export type AvatarEmotion =
  | "neutral" | "happy" | "curious" | "thinking"
  | "focused" | "surprised" | "sleepy" | "concerned";

export type AvatarAction =
  | "idle" | "blink" | "float" | "wave" | "point-left" | "point-right"
  | "listen" | "speak" | "inspect" | "prepare-send"
  | "sending" | "receive" | "celebrate" | "warn" | "rest";

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
  menu: 10,
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
