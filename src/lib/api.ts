// In dev, use a relative path so Vite's proxy forwards /api/* to the Elysia server.
// In production, VITE_API_URL must be set to the deployed API origin.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function api<T = unknown>(
    path: string,
    opts?: { method?: string; body?: unknown },
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: opts?.method ?? (opts?.body ? 'POST' : 'GET'),
        headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
        credentials: 'include', // send session cookie
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `API error ${res.status}`);
    return json as T;
}
