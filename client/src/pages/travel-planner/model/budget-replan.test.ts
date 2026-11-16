import { expect, it } from "vitest";
import { inputPaise } from "./budget-replan";
it("converts explicit decimal forecast text without floating-point arithmetic", () => {
  expect(inputPaise("600.01")).toBe(60001); expect(inputPaise("0")).toBe(0);
  for (const value of ["", "1.001", "-1", "1e5", "₹600"]) expect(() => inputPaise(value)).toThrow();
});
