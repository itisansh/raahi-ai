import { DomainError } from "../shared/errors";
/** Existing non-INR ledgers retain their whole-unit convention. */
export const expenseScale = (currency: string) => currency === "INR" ? 100 : 1;
export function expenseMinor(amount: number, currency: string): number {
  const scale = expenseScale(currency);
  const scaled = Math.round(amount * scale);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || scaled <= 0 || scaled > 999999999999 || Math.abs(amount * scale - scaled) > 0.00001) throw new DomainError("invalid_amount", "Use a positive amount with at most two decimal places for INR; other currencies require whole units");
  return scaled;
}
export function expenseAllocations(amount: number, currency: string, participants: string[], custom?: Record<string, number>) {
  const total = expenseMinor(amount, currency);
  if (!participants.length || new Set(participants).size !== participants.length) throw new DomainError("invalid_participants", "Select each participant exactly once");
  const ids = [...participants].sort();
  if (custom) {
    if (Object.keys(custom).length !== ids.length || ids.some(id => !(id in custom))) throw new DomainError("invalid_splits", "Custom shares must name the exact participants");
    const shares = Object.fromEntries(ids.map(id => [id, expenseMinor(custom[id]!, currency)]));
    if (Object.values(shares).reduce((sum, value) => sum + value, 0) !== total) throw new DomainError("invalid_splits", "Custom shares must sum exactly to the expense amount");
    return shares;
  }
  return Object.fromEntries(ids.map((id, i) => [id, Math.floor(total / ids.length) + (i < total % ids.length ? 1 : 0)]));
}
