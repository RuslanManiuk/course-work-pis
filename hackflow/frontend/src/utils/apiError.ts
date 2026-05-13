/**
 * Backend always returns detail as { code, message } (see AppError in exceptions.py).
 * This helper safely extracts a displayable string from any API error shape.
 */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  const detail = (err as any)?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && typeof detail.message === 'string') return detail.message;
  if (Array.isArray(detail)) return detail.map((d: any) => d.msg ?? d.message ?? String(d)).join('; ');
  return fallback;
}
