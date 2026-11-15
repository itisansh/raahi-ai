import { expect, it } from "vitest";
import { toMinor } from "./finance";
it("accepts exact INR paise and preserves other currencies' whole-unit semantics", () => {
  expect(toMinor("600.01", "INR")).toBe(60001);
  expect(toMinor("0.01", "INR")).toBe(1);
  expect(toMinor("600", "JPY")).toBe(600);
  for (const value of ["", "0", "-1", "1.001", "1e3", "Infinity", "999999999999999"]) expect(toMinor(value, "INR")).toBeNull();
  expect(toMinor("600.01", "JPY")).toBeNull();
});
