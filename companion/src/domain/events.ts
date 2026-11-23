export type MenuId = "send" | "receive" | "assets" | "archive";

/**
 * Facts about the wallet and the app. Only use cases that measured the fact
 * may emit these. In particular nothing in the UI or avatar layer may emit
 * PAYMENT_SUCCEEDED: an animation finishing is not a payment settling.
 */
export type DomainEvent =
  | { type: "APP_READY"; id: string }
  | { type: "MENU_OPENED"; id: string; menu: MenuId }
  | { type: "AVATAR_TAPPED"; id: string }
  | { type: "AMOUNT_ENTERED"; id: string }
  | { type: "WALLET_SYNC_STARTED"; id: string }
  | { type: "WALLET_SYNC_SUCCEEDED"; id: string; timestamp: string }
  | { type: "WALLET_SYNC_FAILED"; id: string; errorCode: string }
  | { type: "PAYMENT_REVIEW_READY"; id: string }
  | { type: "PAYMENT_SUBMITTED"; id: string; operationId: string }
  | { type: "PAYMENT_SUCCEEDED"; id: string; operationId: string }
  | { type: "PAYMENT_FAILED"; id: string; operationId: string }
  | { type: "PAYMENT_OUTCOME_UNKNOWN"; id: string; operationId: string }
  | { type: "PAYMENT_RECEIVED"; id: string; movementId: string }
  | { type: "RECEIVE_SHOWN"; id: string }
  | { type: "MAINTENANCE_REQUIRED"; id: string; severity: "notice" | "urgent" }
  | { type: "BACKUP_FAILED"; id: string }
  | { type: "VOICE_LISTENING"; id: string }
  | { type: "USER_IDLE"; id: string };

export type DomainEventType = DomainEvent["type"];
type Listener = (event: DomainEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();
  private counter = 0;

  nextId(prefix = "evt"): string {
    this.counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.counter}`;
  }

  emit(event: DomainEvent): void {
    for (const l of [...this.listeners]) l(event);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
