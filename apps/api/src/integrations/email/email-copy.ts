import type { EmailLocale } from "./email-locale";

export type OtpEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

export type LinkEmailType = "reset-password" | "change-email-confirmation";

export interface OtpEmailCopy {
  subject: string;
  heading: string;
  intro: string;
  expiry: (minutes: number) => string;
  ignore: string;
}

export interface LinkEmailCopy {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  orOpenLink: string;
  ignore: string;
  /** Shown when a detail line is provided (e.g. requested new email). */
  detail: (value: string) => string;
}

const OTP_COPY: Record<EmailLocale, Record<OtpEmailType, OtpEmailCopy>> = {
  en: {
    "sign-in": {
      subject: "Your Raahi AI sign-in code",
      heading: "Your sign-in code",
      intro: "Use this code to finish signing in to Raahi AI.",
      expiry: (m) => `It expires in ${m} minute${m === 1 ? "" : "s"}.`,
      ignore: "If you did not request this, you can ignore this email.",
    },
    "email-verification": {
      subject: "Verify your Raahi AI email",
      heading: "Verify your email",
      intro: "Enter this code to verify your Raahi AI account.",
      expiry: (m) => `It expires in ${m} minute${m === 1 ? "" : "s"}.`,
      ignore: "If you did not request this, you can ignore this email.",
    },
    "forget-password": {
      subject: "Reset your Raahi AI password",
      heading: "Reset your password",
      intro: "Enter this code to set a new password for your account.",
      expiry: (m) => `It expires in ${m} minute${m === 1 ? "" : "s"}.`,
      ignore: "If you did not request this, you can ignore this email.",
    },
    "change-email": {
      subject: "Confirm your new Raahi AI email",
      heading: "Confirm your new email",
      intro: "Enter this code to confirm your new email address.",
      expiry: (m) => `It expires in ${m} minute${m === 1 ? "" : "s"}.`,
      ignore: "If you did not request this, you can ignore this email.",
    },
  },
};

const LINK_COPY: Record<EmailLocale, Record<LinkEmailType, LinkEmailCopy>> = {
  en: {
    "reset-password": {
      subject: "Reset your Raahi AI password",
      heading: "Reset your password",
      intro:
        "Use the button below to set a new password for your Raahi AI account.",
      button: "Reset password",
      orOpenLink: "Or open this link:",
      ignore: "If you did not request this, you can ignore this email.",
      detail: (value) => value,
    },
    "change-email-confirmation": {
      subject: "Confirm your Raahi AI email change",
      heading: "Confirm your email change",
      intro:
        "Confirm that you want to change the email on your Raahi AI account.",
      button: "Confirm email change",
      orOpenLink: "Or open this link:",
      ignore: "If you did not request this, you can ignore this email.",
      detail: (value) => `Requested new email: ${value}`,
    },
  },
};

export function otpEmailCopy(
  locale: EmailLocale,
  type: OtpEmailType,
): OtpEmailCopy {
  return OTP_COPY[locale][type];
}

export function linkEmailCopy(
  locale: EmailLocale,
  type: LinkEmailType,
): LinkEmailCopy {
  return LINK_COPY[locale][type];
}
