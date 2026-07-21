import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  details?: unknown[];
};

export function successResponse(
  requestId: string,
  data: unknown,
  status = 200
) {
  return NextResponse.json(
    {
      ok: true,
      requestId,
      data,
    },
    { status }
  );
}

export function errorResponse(
  requestId: string,
  status: number,
  error: ApiErrorPayload
) {
  return NextResponse.json(
    {
      ok: false,
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details || [],
      },
    },
    { status }
  );
}

export function errorCodeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "VALIDATION_ERROR";

  return "INTERNAL_ERROR";
}
