import { expect, it } from "vitest";
import { EMAIL_LANG_HEADER, resolveEmailLocale } from "../src/integrations/email/email-locale";

it("uses the renamed email header and accepts older clients", () => {
  expect(EMAIL_LANG_HEADER).toBe("x-raahi-lang");
  expect(resolveEmailLocale(new Headers({ "x-raahi-lang": "en" }))).toBe("en");
  expect(resolveEmailLocale(new Headers({ "x-opentrip-lang": "en" }))).toBe("en");
  expect(resolveEmailLocale(new Headers({ "accept-language": "en-IN" }))).toBe("en");
});
