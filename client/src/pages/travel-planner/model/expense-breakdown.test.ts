import { expect, it } from "vitest";
import type { Expense } from "@/lib/models/expense";
import { memberBreakdown, traceSettlements } from "./expense-breakdown";
const meal: Expense = { id: "meal", description: "Lunch", amount: 600.01, currency: "INR", payer: "a", participants: ["d", "c", "b", "a"], category: "Food", whenLabel: "Today" };
it("preserves the exact remainder across four of five participants", () => {
  const rows = ["a", "b", "c", "d", "e"].map(id => memberBreakdown([meal], id, "INR"));
  expect(rows.map(row => row.shareSum)).toEqual([150.01, 150, 150, 150, 0]);
  expect(rows.reduce((sum, row) => sum + Math.round((row.paidSum - row.shareSum) * 100), 0)).toBe(0);
});
it("explains custom saved shares and excludes other currencies", () => {
  const expenses = [{ ...meal, shares: { a: 100.01, b: 200, c: 100, d: 200 } }, { ...meal, id: "foreign", amount: 999, currency: "USD" }];
  expect(memberBreakdown(expenses, "b", "INR")).toMatchObject({ shareSum: 200, paidSum: 0, shareItems: [{ amount: 200 }] });
  expect(memberBreakdown(expenses, "a", "INR")).toMatchObject({ shareSum: 100.01, paidSum: 600.01 });
});
it("sums repeated fractional shares in minor units", () => {
  const expenses = Array.from({ length: 10 }, (_, i) => ({ ...meal, id: String(i), amount: 0.1, participants: ["a"], shares: { a: 0.1 } }));
  expect(memberBreakdown(expenses, "a", "INR")).toMatchObject({ shareSum: 1, paidSum: 1 });
});

it("explains paise-sized settlement transfers without scaling rupees twice", () => {
  const balances = [{ memberId: "a", paid: 0, share: 0.01, net: -0.01 }, { memberId: "b", paid: 600, share: 0, net: 600 }, { memberId: "c", paid: 0, share: 599.99, net: -599.99 }];
  const traces = [...traceSettlements(balances, "INR").values()];
  expect(traces.map(row => row.amount)).toEqual([599.99, 0.01]);
  expect(traces[1]).toMatchObject({ debtorOwed: 0.01, creditorDue: 600, creditorRemaining: 0.01 });
});
it("keeps whole-unit currencies in their original units", () => {
  const balances = [{ memberId: "a", paid: 0, share: 600, net: -600 }, { memberId: "b", paid: 600, share: 0, net: 600 }];
  expect([...traceSettlements(balances, "JPY").values()][0]).toMatchObject({ amount: 600, debtorOwed: 600, creditorRemaining: 600 });
});
it("explains repayments separately without changing expense shares", () => {
  const repayments = [{ from: "b", to: "a", amountMinor: 5001, currency: "INR" }, { from: "b", to: "a", amountMinor: 100, currency: "INR", voidedAt: "2099-01-01" }];
  expect(memberBreakdown([meal], "b", "INR", repayments)).toMatchObject({ transferNet: 50.01, shareSum: 150, paidSum: 0 });
  expect(memberBreakdown([meal], "a", "INR", repayments)).toMatchObject({ transferNet: -50.01, shareSum: 150.01, paidSum: 600.01 });
});
