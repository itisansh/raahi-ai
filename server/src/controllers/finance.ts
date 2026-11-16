import { z } from "zod";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";

export function createFinanceControllers(container: Container) {
  const { config } = container;
  return {
    listHistory: async c => {
      if (!container.historyService) return fail(c, "history_unavailable", "History requires Mongo runtime", 503);
      return ok(c, await container.historyService.list(c.req.param("id"), c.get("user")!.id));
    },

    rollbackHistory: async c => {
      if (!config.trustedOrigins.includes(c.req.header("origin") ?? "")) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      if (!container.historyService) return fail(c, "history_unavailable", "History requires Mongo runtime", 503);
      return ok(c, await container.historyService.rollback(c.req.param("id"), c.get("user")!.id, await c.req.json()));
    },

    getFinance: async c => {
      if (!container.financeService) return fail(c, "finance_unavailable", "Finance requires Mongo runtime", 503);
      return ok(c, await container.financeService.status(c.req.param("id"), c.get("user")!.id));
    },

    updateFinance: async c => {
      if (!config.trustedOrigins.includes(c.req.header("origin") ?? "")) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      if (!container.financeService) return fail(c, "finance_unavailable", "Finance requires Mongo runtime", 503);
      const action = z.enum(["repay", "void", "cap"]).parse(c.req.param("action"));
      return ok(c, await container.financeService[action](c.req.param("id"), c.get("user")!.id, await c.req.json()));
    },

    getBudget: async (c) => {
      if (!container.budgetService) return fail(c, "budget_unavailable", "Budget intelligence unavailable", 503);
      return ok(c, await container.budgetService.status(c.req.param("id"), c.get("user")!.id));
    },

    updateBudget: async (c) => {
      if (!config.trustedOrigins.includes(c.req.header("origin") ?? "")) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      if (!container.budgetService) return fail(c, "budget_unavailable", "Budget intelligence unavailable", 503);
      const action = z.enum(["forecast", "propose", "approve"]).parse(c.req.param("action"));
      const body = await c.req.json().catch(() => null);
      const actor = c.get("user")!.id;
      if (action === "forecast") return ok(c, await container.budgetService.setForecast(c.req.param("id"), actor, body));
      if (action === "propose") {
        z.object({}).strict().parse(body);
        return ok(c, await container.budgetService.propose(c.req.param("id"), actor));
      }
      const { proposalId } = z.object({ proposalId: z.string().uuid(), confirm: z.literal(true) }).strict().parse(body);
      return ok(c, await container.budgetService.approve(proposalId, actor, c.req.param("id")));
    }
  } satisfies Record<string, Controller>;
}

