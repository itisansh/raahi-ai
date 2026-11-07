import { expect, it } from "vitest";
import { resolveExpenseMembers, type ExpenseVoiceDraft } from "./expense-voice";
const base: ExpenseVoiceDraft = { description: "Lunch", amountRupees: "600", currency: "INR", payerName: null, payerIsSelf: true, participantNames: [], participantCount: 4 };
it("never picks four beneficiaries from a five-member group without names", () => {
  const members = ["a", "b", "c", "d", "e"].map(id => ({ id, name: id, isCurrentUser: id === "a" }));
  expect(resolveExpenseMembers(base, members)).toEqual({ payer: "a", participants: [] });
});
it("refuses ambiguous names and unrecognized model suggestions", () => {
  const members = [{ id: "a", name: "Ansh" }, { id: "b", name: "Ansh" }, { id: "c", name: "Priya" }];
  expect(resolveExpenseMembers({ ...base, payerIsSelf: false, payerName: "Ansh", participantNames: ["Ansh", "Priya", "Invented"] }, members)).toEqual({ payer: "", participants: ["c"] });
});
