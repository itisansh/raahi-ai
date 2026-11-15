import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readPersistedValue } from "./persisted-storage";
import { getStoredTheme } from "./theme";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("retains the existing theme and writes the renamed key", () => {
  values.set("opentrip.theme", "dark");
  expect(getStoredTheme()).toBe("dark");
  expect(values.get("raahi.theme")).toBe("dark");
  expect(values.get("opentrip.theme")).toBe("dark");
});
it.each(["journal-preview.v1:owner", "today-place.v1:owner", "mobile-onboarding.v1"])("copies %s without changing the saved document", (suffix) => {
  const value = JSON.stringify({ id: "existing", body: "My journal", location: "dismissed" });
  values.set(`opentrip.${suffix}`, value);
  expect(readPersistedValue(`raahi.${suffix}`)).toBe(value);
  expect(values.get(`raahi.${suffix}`)).toBe(value);
});
it("does not overwrite newer preferences or merge another user's journal", () => {
  values.set("opentrip.theme", "light"); values.set("raahi.theme", "dark");
  values.set("opentrip.journal-preview.v1:owner", "private journal");
  expect(getStoredTheme()).toBe("dark");
  expect(readPersistedValue("raahi.journal-preview.v1:other-user")).toBeNull();
});
it("keeps the old value readable if storage is full", () => {
  values.set("opentrip.theme", "dark");
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: () => { throw new Error("QuotaExceededError"); },
  });
  expect(getStoredTheme()).toBe("dark");
  expect(values.get("opentrip.theme")).toBe("dark");
});
