import type { Container } from "../config/container";
import { ok } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
import { createControllerHelpers } from "./helpers";
import { expenseSchema } from "./schemas";

export function createExpensesControllers(container: Container, options: CreateAppOptions) {
  const { tripService } = container;
  const { notifyAgent } = createControllerHelpers(container, options);
  return {
    addExpense: async (c) => {
      const input = expenseSchema.parse(await c.req.json());
      const dto = await tripService.addExpense(
        c.req.param("id"),
        input,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "add_expense",
        summary: `added expense "${input.description}" (${input.amount})`,
        details: { input },
      });
      return ok(c, dto);
    },

    updateExpense: async (c) => {
      const input = expenseSchema.parse(await c.req.json());
      const expenseId = c.req.param("expenseId");
      const dto = await tripService.updateExpense(
        c.req.param("id"),
        expenseId,
        input,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "update_expense",
        summary: `updated expense "${input.description}"`,
        details: { expenseId, changes: input },
      });
      return ok(c, dto);
    }
  } satisfies Record<string, Controller>;
}

