import { config } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public current?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface SuccessEnvelope<T> {
  data: T;
}

interface ErrorEnvelope {
  error: { code: string; message: string; current?: unknown };
}

/** Typed fetch against the API. Sends cookies (Better Auth session), parses the
 * `{ data }` / `{ error }` envelope, and throws `ApiError` on failure. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  onReply?: (text: string) => void,
): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(onReply ? { Accept: "application/x-ndjson" } : {}),
      ...init?.headers,
    },
  });

  if (res.ok && onReply && res.headers.get("content-type")?.includes("application/x-ndjson")) {
    if (!res.body) throw new ApiError("invalid_stream", "Missing response stream", 502);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; text?: string; data?: T; code?: string };
          if (event.type === "reply" && typeof event.text === "string") onReply(event.text);
          if (event.type === "error") throw new ApiError(event.code ?? "planning_unavailable", "Planning failed", 503);
          if (event.type === "result" && event.data !== undefined) return event.data;
        }
        if (done) throw new ApiError("incomplete_stream", "Response ended before a result", 502);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as ErrorEnvelope | null)?.error;
    throw new ApiError(
      err?.code ?? "unknown",
      err?.message ?? res.statusText,
      res.status,
      err?.current,
    );
  }

  return (body as SuccessEnvelope<T>).data;
}
