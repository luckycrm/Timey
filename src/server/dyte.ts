/**
 * Dyte video meetings — delegates to Elysia API server.
 * Drop-in replacement for TanStack server functions.
 */
import { api } from '../lib/api';

export async function createDyteMeetingAccess(opts: { data: { channelId: string; channelName: string; participantName: string; orgName?: string; presetName?: string } }) {
    return api<{ success: boolean; error?: string; meetingId?: string; meetingTitle?: string; presetName?: string; authToken?: string; meetingLink?: string }>(
        '/api/dyte/meeting/create',
        { body: opts.data },
    );
}

export async function joinDyteMeetingAccess(opts: { data: { meetingId: string; channelId: string; participantName: string; presetName?: string } }) {
    return api<{ success: boolean; error?: string; meetingId?: string; presetName?: string; authToken?: string; meetingLink?: string }>(
        '/api/dyte/meeting/join',
        { body: opts.data },
    );
}

export async function createPublicDyteMeetingAccess(opts: { data: { orgName?: string; eventTitle: string; inviteeName: string } }) {
    return api<{ success: boolean; error?: string; meetingId?: string; meetingTitle?: string }>(
        '/api/dyte/meeting/public/create',
        { body: opts.data },
    );
}

export async function createPublicMeetingInviteLink(opts: { data: { meetingId: string; orgId: string; title: string; scheduledAt: number } }) {
    return api<{ success: boolean; error?: string; token?: string; inviteUrl?: string; expiresAt?: number }>(
        '/api/dyte/invite/create',
        { body: opts.data },
    );
}

export async function inspectPublicMeetingInvite(opts: { data: { token: string } }) {
    return api<{ success: boolean; error?: string; title?: string; scheduledAt?: number; expiresAt?: number }>(
        '/api/dyte/invite/inspect',
        { body: opts.data },
    );
}

export async function joinPublicMeetingInviteAccess(opts: { data: { token: string; guestName: string } }) {
    return api<{ success: boolean; error?: string; title?: string; scheduledAt?: number; authToken?: string; meetingLink?: string }>(
        '/api/dyte/invite/join',
        { body: opts.data },
    );
}
