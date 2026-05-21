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

/**
 * Per-request timeout in ms. Some flaky-network conditions (and Chrome
 * DevTools "Offline" throttling) leave fetches hanging indefinitely rather
 * than rejecting — the AbortController guarantees we surface a TIMEOUT error
 * after this window and unblock dependent code (mutation rollback, etc).
 */
const REQUEST_TIMEOUT_MS = 30_000;

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<ApiSuccessEnvelope<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    // AbortError fires when we time out OR when the caller passed its own
    // signal and aborted it. TypeError fires for network failures (offline,
    // DNS, CORS, etc).
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 'TIMEOUT', 0);
    }
    if (err instanceof TypeError) {
      throw new ApiError('Network request failed', 'NETWORK_ERROR', 0);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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
