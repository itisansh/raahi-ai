import type { EmailMessage, EmailSender } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface ResendEmailSenderOptions {
  apiKey: string;
  from: string;
}

export class ResendDeliveryError extends Error {
  constructor(public status: number, public code: string, guidance: string) {
    super(`Resend ${status} (${code}): ${guidance}`);
    this.name = "ResendDeliveryError";
  }
}

export function resendFailure(status: number, message: string): ResendDeliveryError {
  const text = message.toLowerCase();
  if (status === 403 && text.includes("testing emails")) return new ResendDeliveryError(status, "test_sender_restricted", "Set EMAIL_FROM to an address on your verified domain in the running server environment, then restart or redeploy.");
  if (status === 403 && (text.includes("not verified") || text.includes("verify a domain"))) return new ResendDeliveryError(status, "sender_domain_unverified", "Verify the exact EMAIL_FROM domain in Resend, including its subdomain.");
  if (status === 401 || status === 403) return new ResendDeliveryError(status, "sender_not_authorized", "Check the API key's sending permission and domain scope, and the running server's EMAIL_FROM. Inspect the Resend log response for details.");
  if (status === 429) return new ResendDeliveryError(status, "email_rate_limited", "Email rate limit reached. Wait before requesting another code.");
  return new ResendDeliveryError(status, "email_provider_error", "Check Resend's email logs and service status, then retry.");
}

/** Mask local-part for logs; keep domain for deliverability debugging. */
function redactRecipient(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "[redacted]";
  return `***@${email.slice(at + 1)}`;
}

/** HTTP sender for Resend (no SMTP socket). */
export function createResendEmailSender(
  options: ResendEmailSenderOptions,
): EmailSender {
  const { apiKey, from } = options;
  return {
    async send(message: EmailMessage): Promise<void> {
      const toLog = redactRecipient(message.to);
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: unknown } | null;
        const error = resendFailure(response.status, typeof body?.message === "string" ? body.message : "");
        console.error(`[email:resend] ${error.message} to=${toLog} from=${from}`);
        throw error;
      }

      // Resend returns `{ id: "…" }` on success — log it for dashboard lookup.
      const payload = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;
      // Accepted by Resend; inbox delivery is tracked separately in its dashboard.
      console.info(
        `[email:resend] accepted id=${payload?.id ?? "unknown"} to=${toLog} from=${from} subject=${message.subject}`,
      );
    },
  };
}
