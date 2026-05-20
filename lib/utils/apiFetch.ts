/**
 * Client-side fetch wrapper that understands our `{ success, data, error }`
 * envelope. Throws an `ApiError` on failure so TanStack Query / try/catch can
 * react to the typed code + status.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiSuccessEnvelope<T> = { success: true; data: T; meta?: unknown };
type ApiErrorEnvelope = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiSuccessEnvelope<T>> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let body: ApiSuccessEnvelope<T> | ApiErrorEnvelope;
  try {
    body = (await res.json()) as ApiSuccessEnvelope<T> | ApiErrorEnvelope;
  } catch {
    throw new ApiError(`Non-JSON response (status ${res.status})`, 'INVALID_RESPONSE', res.status);
  }

  if (!res.ok || body.success === false) {
    const err = !body.success ? body.error : { code: 'UNKNOWN', message: 'Request failed' };
    throw new ApiError(err.message, err.code, res.status, 'details' in err ? err.details : undefined);
  }

  return body;
}
