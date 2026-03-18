/**
 * Invite emails — delegates to Elysia API server.
 * Drop-in replacement for TanStack server functions.
 */
import { api } from '../lib/api';

export async function sendInviteEmail(opts: { data: { email: string; orgName: string; token: string } }) {
    return api<{ success: boolean; error?: string; skippedEmail?: boolean }>(
        '/api/email/invite',
        { body: opts.data },
    );
}
