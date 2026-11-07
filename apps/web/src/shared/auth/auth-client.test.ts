import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("sends email signup JSON and captcha through the real auth client", async () => {
  const fetch = vi.fn(async () => Response.json({ user: { id: "fixture" }, token: null }));
  vi.stubGlobal("fetch", fetch);
  const { signUp } = await import("./index");
  const result = await signUp.email({
    name: "Test traveller",
    email: "traveller@example.test",
    password: "test-password-only",
    fetchOptions: { headers: { "x-captcha-response": "test-captcha" } },
  });
  expect(result.error).toBeNull();
  const [url, request] = (fetch.mock.calls as unknown as Array<[URL, RequestInit]>)[0]!;
  expect(new URL(url).pathname).toBe("/api/auth/sign-up/email");
  expect(request.method).toBe("POST");
  const headers = new Headers(request.headers);
  expect(headers.get("x-captcha-response")).toBe("test-captcha");
  expect(headers.get("x-opentrip-lang")).toBe("en");
  expect(JSON.parse(request.body as string)).toEqual({
    name: "Test traveller", email: "traveller@example.test", password: "test-password-only",
  });
});
