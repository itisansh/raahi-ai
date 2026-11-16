import type { RuntimeName } from "../services/observability";

export interface CreateAppOptions {
  runtime: RuntimeName;
  setRequestContext?: (fields: { requestId: string }) => void;
}
