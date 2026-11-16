import type { Container } from "../src/config/container";
import { describe, expect, it, vi } from "vitest";
import { VoiceExpenseService } from "../src/services/expenses/voice-expense";
import { computeBudget } from "../src/services/rules/trip/settlement";
import type { ExpenseSnapshot, MemberSnapshot } from "../src/services/rules/trip/types";
const extracted = { description: "Lunch", amountRupees: "600", currency: "INR", payerName: null, payerIsSelf: true, participantNames: [], participantCount: 4 };
it("keeps an unspecified four-person subset unresolved and does not calculate shares", async () => {
  const authorize = vi.fn(async () => {}); const extract = vi.fn(async () => extracted);
  const service = new VoiceExpenseService({ extract }, authorize, { consume: async () => true });
  expect(await service.preview("trip", "actor", "I paid 600 rupees for lunch for four people")).toEqual({ ...extracted, saved: false });
  expect(authorize).toHaveBeenCalledWith("trip", "actor");
});
it("checks edit permission before contacting the model", async () => {
  const extract = vi.fn(); const service = new VoiceExpenseService({ extract }, async () => { throw new Error("forbidden"); }, { consume: async () => true });
  await expect(service.preview("trip", "viewer", "expense")).rejects.toThrow("forbidden");
  expect(extract).not.toHaveBeenCalled();
});
it("rejects invalid output, limits generation and allows missing-provider failure", async () => {
  const model = { extract: async () => ({ ...extracted, amountRupees: "600 / 4" }) };
  await expect(new VoiceExpenseService(model, async () => {}, { consume: async () => true }).preview("t", "u", "expense")).rejects.toMatchObject({ code: "expense_voice_invalid" });
  await expect(new VoiceExpenseService(model, async () => {}, { consume: async () => false }).preview("t", "u", "expense")).rejects.toMatchObject({ code: "expense_voice_rate_limited" });
  await expect(new VoiceExpenseService(null, async () => {}, { consume: async () => true }).preview("t", "u", "expense")).rejects.toMatchObject({ code: "expense_voice_unavailable" });
});
describe("whole-unit ledger conservation", () => {
  const members = ["a", "b", "c", "d", "e"].map(id => ({ id })) as MemberSnapshot[];
  it("splits 600 across selected four while excluding the fifth", () => {
    const budget = computeBudget(members, [{ amount: 600, payer: "a", participants: ["a", "b", "c", "d"] }] as ExpenseSnapshot[], "JPY");
    expect(budget.balances.map(b => b.share)).toEqual([150, 150, 150, 150, 0]);
    expect(budget.balances.reduce((s, b) => s + b.net, 0)).toBe(0);
  });
  it("assigns remainder deterministically and clears every balance", () => {
    for (let amount = 1; amount <= 100; amount++) {
      const budget = computeBudget(members, [{ amount, payer: "a", participants: ["c", "b", "a"] }] as ExpenseSnapshot[], "JPY");
      expect(budget.balances.reduce((s, b) => s + b.share, 0)).toBe(amount);
      expect(budget.balances.reduce((s, b) => s + b.net, 0)).toBe(0);
      const net = new Map(budget.balances.map(b => [b.memberId, b.net]));
      for (const payment of budget.settlements) { net.set(payment.from, net.get(payment.from)! + payment.amount); net.set(payment.to, net.get(payment.to)! - payment.amount); }
      expect([...net.values()].every(v => v === 0)).toBe(true);
    }
  });
});
it("rejects fractional or duplicate-member writes instead of silently rounding", async () => {
  const { Trip } = await import("../src/services/rules/trip");
  const trip = Trip.create({ title: "Test" }, { id: "owner", name: "Owner" });
  const member = trip.toSnapshot().members[0]!.id;
  const draft = { description: "Lunch", currency: "JPY", amount: 600, payer: member, participants: [member] };
  expect(() => trip.addExpense({ ...draft, amount: 600.50 })).toThrow("positive amount");
  expect(() => trip.addExpense({ ...draft, participants: [member, member] })).toThrow("each participant");
  const expense = trip.addExpense(draft);
  expect(() => trip.updateExpense(expense.id, { ...draft, amount: 1.5 })).toThrow("positive amount");
  expect(trip.toSnapshot().expenses).toHaveLength(1);
  expect(trip.toSnapshot().expenses[0]!.amount).toBe(600);
});
it("protects the expense draft HTTP endpoint and rejects client save instructions", async () => {
  const { createApp } = await import("./http-app");
  const preview = vi.fn(async () => ({ ...extracted, saved: false }));
  let authenticated = true;
  const app = createApp({ config: { trustedOrigins: ["https://web.test"] }, auth: { api: { getSession: async () => authenticated ? { user: { id: "actor" }, session: {} } : null } }, voiceExpenseService: { preview }, agentService: null } as unknown as Container);
  const request = (body: unknown, origin = "https://web.test") => app.request("https://web.test/api/trips/trip/expenses/preview", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect((await request({ prompt: "I paid 600 rupees" }, "https://evil.test")).status).toBe(403);
  expect((await request({ prompt: "I paid 600 rupees", confirm: true })).status).toBe(400);
  expect(preview).not.toHaveBeenCalled();
  const response = await request({ prompt: "I paid 600 rupees" });
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect(preview).toHaveBeenCalledWith("trip", "actor", "I paid 600 rupees");
  authenticated = false;
  expect((await request({ prompt: "I paid 600 rupees" })).status).toBe(401);
});
it("conserves paise and validates custom shares exactly", async () => {
  const { expenseAllocations } = await import("../src/services/rules/trip/expense-money");
  expect(expenseAllocations(1, "INR", ["c", "a", "b"])).toEqual({ a: 34, b: 33, c: 33 });
  expect(expenseAllocations(600.01, "INR", ["a", "b"], { a: 400, b: 200.01 })).toEqual({ a: 40000, b: 20001 });
  expect(() => expenseAllocations(600.01, "INR", ["a", "b"], { a: 400, b: 200 })).toThrow("sum exactly");
  expect(() => expenseAllocations(1.001, "INR", ["a"])).toThrow("positive amount");
  const budget = computeBudget([{ id: "a" }, { id: "b" }, { id: "c" }] as MemberSnapshot[], [{ payer: "a", amount: 1, currency: "INR", participants: ["a", "b", "c"] }] as ExpenseSnapshot[], "INR");
  expect(budget.settlements.map(s => s.amount)).toEqual([0.33, 0.33]);
  expect(budget.balances.map(b => b.net)).toEqual([0.66, -0.33, -0.33]);
});
