import { afterEach, expect, it, vi } from "vitest";
import { createResendEmailSender, resendFailure } from "../src/integrations/email/resend-email-sender";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("sends the code to the submitted signup email with the configured verified sender", async () => {
  const fetcher = vi.fn(async () => Response.json({ id: "email-test" }));
  vi.stubGlobal("fetch", fetcher); vi.spyOn(console, "info").mockImplementation(() => {});
  await createResendEmailSender({ apiKey: "test-key", from: "Raahi AI <noreply@raahi.example.test>" }).send({ to: "another-person@example.test", subject: "Verify", text: "Synthetic code 123456" });
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.resend.com/emails");
  expect(JSON.parse(options.body as string)).toMatchObject({ to: ["another-person@example.test"], from: "Raahi AI <noreply@raahi.example.test>" });
  expect(options.signal).toBeDefined();
});
it.each([
  ["You can only send testing emails to your own email address", "test_sender_restricted"],
  ["The raahi.example.test domain is not verified", "sender_domain_unverified"],
  ["API key is restricted to another domain", "sender_not_authorized"],
])("identifies the 403 cause without retrying or logging the code: %s", async (message, code) => {
  const fetcher = vi.fn(async () => Response.json({ message }, { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(createResendEmailSender({ apiKey: "secret-test-key", from: "noreply@example.test" }).send({ to: "person@example.test", subject: "Verify", text: "Secret code 123456" })).rejects.toMatchObject({ status: 403, code });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456|secret-test-key|person@/);
});
it("distinguishes provider throttling", () => expect(resendFailure(429, "limit").code).toBe("email_rate_limited"));
