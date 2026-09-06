/**
 * Email provider abstraction.
 *
 * Swap `activeEmailProvider` for a real provider (Resend, SendGrid, SES)
 * by implementing EmailProvider. The dev provider logs the message and
 * returns any action URL so the UI can surface it during development.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Optional primary action link (e.g. verification URL). */
  actionUrl?: string;
}

export interface EmailProvider {
  name: string;
  /** Returns a dev-only action URL when the email is not actually sent. */
  send(message: EmailMessage): Promise<{ devActionUrl: string | null }>;
}

const devProvider: EmailProvider = {
  name: "dev-log",
  async send(message) {
    console.log(
      `[email:dev] to=${message.to} subject="${message.subject}"` +
        (message.actionUrl ? ` action=${message.actionUrl}` : ""),
    );
    return { devActionUrl: message.actionUrl ?? null };
  },
};

export const activeEmailProvider: EmailProvider = devProvider;
