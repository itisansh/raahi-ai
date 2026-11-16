import type { HttpContext } from "../middleware/web-context";

export function ok<T>(c: HttpContext, data: T, status: number = 200) {
  return c.json({ data }, status);
}

export function fail(
  c: HttpContext,
  code: string,
  message: string,
  status: number,
) {
  return c.json({ error: { code, message } }, status);
}
