import type { ApiErrorCode } from "@/lib/server/api/responses";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details: unknown[] = []
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
