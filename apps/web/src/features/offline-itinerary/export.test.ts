import { expect, it } from "vitest";
import { offlineItineraryHtml } from "./export";
it("creates a standalone offline snapshot without active content or group financial data", () => {
  const trip = { id: "fixture", title: '<script>alert("x")</script>', days: [{ number: 1, date: "2026-11-03", city: "Chopta" }], stops: [{ id: "stop", day: 1, name: '<img src=x onerror="bad()">', time: "10:00", area: "Uttarakhand", lat: 30.49, lng: 79.16 }], expenses: [{ amount: 999, description: "Private expense" }], members: [{ name: "Private member" }] };
  const html = offlineItineraryHtml(trip, "2026-11-02T00:00:00Z");
  expect(html).toContain("Chopta"); expect(html).toContain("tel:112"); expect(html).toContain("Content-Security-Policy");
  expect(html).not.toContain("<script>"); expect(html).not.toContain("<img "); expect(html).not.toContain("Private expense"); expect(html).not.toContain("Private member");
  expect(html).toContain("&lt;script&gt;"); expect(html).toContain("snapshot, not the current shared plan");
});
