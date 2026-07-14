/**
 * Pluggable notification sink — implementation decides where the
 * actual delivery goes (email/push/webhook/console). The persistence
 * layer (in-app Notification row) is always written regardless.
 */
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MailContact {
  email: string;
  name?: string | null;
}

export interface NotificationPort {
  /**
   * Persist an in-app notification row AND push it to the configured
   * real-time channel. Implementations MUST be resilient (no throw).
   */
  send(payload: NotificationPayload): Promise<void>;
}
