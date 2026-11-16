import { describe, expect, it } from "vitest";
import { credentialErrorKey } from "./auth-error";

describe("public credential error messages", () => {
  it("identifies password and duplicate-account rejection", () => {
    expect(credentialErrorKey({ code: "PASSWORD_TOO_SHORT", status: 400 })).toBe("passwordTooShort");
    expect(credentialErrorKey({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toBe("accountExists");
  });
  it("distinguishes service failures and rate limits", () => {
    expect(credentialErrorKey({ status: 503 })).toBe("serviceUnavailable");
    expect(credentialErrorKey({ status: 429 })).toBe("rateLimited");
  });
  it("maps unknown internal codes to generic copy", () => {
    expect(credentialErrorKey({ code: "INTERNAL_DATABASE_DETAILS" })).toBe("generic");
  });
  it("recognizes the installed captcha and sign-in failure codes", () => {
    expect(credentialErrorKey({ code: "PROVIDER_NOT_FOUND", status: 404 })).toBe("providerUnavailable");
    expect(credentialErrorKey({ code: "VERIFICATION_FAILED", status: 400 })).toBe("captchaFailed");
    expect(credentialErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("invalidCredentials");
    expect(credentialErrorKey({ code: "INVALID_ORIGIN", status: 403 })).toBe("invalidOrigin");
  });
});
