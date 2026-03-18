/**
 * Auth/OTP — delegates to Elysia API server at VITE_API_URL (default: http://localhost:3001).
 * Drop-in replacement for TanStack server functions.
 */
import { api } from '../lib/api';

export async function requestOtp(opts: { data: { email: string } }) {
    return api<{ success: boolean; error?: string; devCode?: string }>(
        '/api/auth/otp/request',
        { body: { email: opts.data.email } },
    );
}

export async function verifyOtp(opts: { data: { email: string; code: string } }) {
    return api<{ success: boolean; error?: string; email?: string }>(
        '/api/auth/otp/verify',
        { body: { email: opts.data.email, code: opts.data.code } },
    );
}

export async function getSession() {
    return api<{ authenticated: boolean; email?: string }>('/api/auth/session');
}

export async function logout() {
    return api<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
}
