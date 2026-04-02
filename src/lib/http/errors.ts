import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "CONFIG_ERROR"
  | "PLANNER_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };

  return NextResponse.json(body, { status });
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
