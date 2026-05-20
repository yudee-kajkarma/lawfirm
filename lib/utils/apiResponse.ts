import { NextResponse } from 'next/server';

type Meta = {
  page?: number;
  limit?: number;
  total?: number;
  cursor?: string | null;
};

export type ApiSuccess<T> = { success: true; data: T; meta?: Meta };
export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function apiOk<T>(payload: { data: T; meta?: Meta }, status = 200): NextResponse {
  const body: ApiSuccess<T> = {
    success: true,
    data: payload.data,
    ...(payload.meta ? { meta: payload.meta } : {}),
  };
  return NextResponse.json(body, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  const body: ApiFailure = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}
