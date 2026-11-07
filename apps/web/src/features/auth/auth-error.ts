/** Map known public auth codes to local copy. Never render raw provider errors. */
export function credentialErrorKey(error: { code?: string; status?: number }) {
  if (error.status === 429) return "rateLimited";
  if (error.status && error.status >= 500) return "serviceUnavailable";
  switch (error.code) {
    case "PROVIDER_NOT_FOUND": return "providerUnavailable";
    case "PASSWORD_TOO_SHORT": return "passwordTooShort";
    case "PASSWORD_TOO_LONG": return "passwordTooLong";
    case "INVALID_EMAIL": return "invalidEmail";
    case "INVALID_EMAIL_OR_PASSWORD": return "invalidCredentials";
    case "INVALID_ORIGIN": return "invalidOrigin";
    case "FAILED_TO_CREATE_USER": return "createFailed";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return "accountExists";
    case "MISSING_RESPONSE":
    case "VERIFICATION_FAILED":
    case "CAPTCHA_VERIFICATION_FAILED":
    case "CAPTCHA_FAILED": return "captchaFailed";
    default: return "generic";
  }
}
