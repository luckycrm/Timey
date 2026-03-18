import { Elysia, t } from 'elysia';
import crypto from 'node:crypto';
import { parseSessionFromCookie } from '../lib/session';

const DYTE_BASE_URL = process.env.DYTE_BASE_URL ?? 'https://api.cluster.dyte.in/v2';
const DYTE_API_KEY = process.env.DYTE_API_KEY ?? '';
const DYTE_ORG_ID = process.env.DYTE_ORG_ID ?? '';
const DEFAULT_PRESET = process.env.DYTE_PRESET_NAME ?? 'group_call_host';
const GUEST_PRESET = process.env.DYTE_GUEST_PRESET_NAME ?? DEFAULT_PRESET;
const INVITE_SECRET = process.env.MEETING_LINK_SECRET ?? process.env.SESSION_SECRET ?? 'timey-dev-meeting-secret';

function dyteAuth(): string {
    return 'Basic ' + Buffer.from(`${DYTE_ORG_ID}:${DYTE_API_KEY}`).toString('base64');
}

async function dytePost(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
    const res = await fetch(`${DYTE_BASE_URL}${path}`, {
        method: 'POST',
        headers: { Authorization: dyteAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
}

async function dyteGet(path: string): Promise<{ ok: boolean; data: unknown }> {
    const res = await fetch(`${DYTE_BASE_URL}${path}`, {
        headers: { Authorization: dyteAuth() },
    });
    const data = await res.json();
    return { ok: res.ok, data };
}

function pick(obj: unknown, ...paths: string[][]): string | null {
    for (const path of paths) {
        let cur: unknown = obj;
        for (const key of path) {
            if (typeof cur !== 'object' || cur == null) { cur = null; break; }
            cur = (cur as Record<string, unknown>)[key];
        }
        if (typeof cur === 'string' && cur.trim()) return cur.trim();
    }
    return null;
}

async function getPresetName(preferred?: string): Promise<string> {
    if (preferred) return preferred;
    try {
        const { data } = await dyteGet('/presets');
        const names: string[] = (data as { data?: { name: string }[] })?.data?.map((p) => p.name) ?? [];
        return names.find((n) => n.toLowerCase().includes('group')) ?? names[0] ?? DEFAULT_PRESET;
    } catch {
        return DEFAULT_PRESET;
    }
}

type InvitePayload = {
    version: 1;
    kind: 'public_meeting';
    dyteMeetingId: string;
    orgId: string;
    title: string;
    scheduledAt: number;
    expiresAt: number;
};

function signInvite(payload: InvitePayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', INVITE_SECRET).update(encoded).digest('hex');
    return `${encoded}.${sig}`;
}

function verifyInvite(token: string): InvitePayload | null {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac('sha256', INVITE_SECRET).update(encoded).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    try {
        return JSON.parse(Buffer.from(encoded, 'base64url').toString()) as InvitePayload;
    } catch {
        return null;
    }
}

export const dyteRoutes = new Elysia({ prefix: '/api/dyte' })

    .post('/meeting/create', async ({ body, request, set }) => {
        const session = parseSessionFromCookie(request.headers.get('cookie'));
        if (!session) return (set.status = 401, { error: 'Unauthorized' });

        const preset = await getPresetName(body.presetName);
        const { ok: mOk, data: mData } = await dytePost('/meetings', {
            title: body.channelName,
            preferred_region: 'ap-south-1',
            record_on_start: false,
        });
        if (!mOk) return (set.status = 502, { error: 'Failed to create meeting' });

        const meetingId = pick(mData, ['data', 'id'], ['id']);
        if (!meetingId) return (set.status = 502, { error: 'No meeting ID in response' });

        const { ok: pOk, data: pData } = await dytePost(`/meetings/${meetingId}/participants`, {
            name: body.participantName,
            preset_name: preset,
            custom_participant_id: `user-${body.channelId}`,
        });
        if (!pOk) return (set.status = 502, { error: 'Failed to add participant' });

        const authToken = pick(pData, ['data', 'token'], ['token']);
        return {
            success: true,
            meetingId,
            meetingTitle: body.channelName,
            presetName: preset,
            authToken,
            meetingLink: `https://meet.timey.app/${meetingId}`,
        };
    }, {
        body: t.Object({
            channelId: t.String(),
            channelName: t.String(),
            participantName: t.String(),
            presetName: t.Optional(t.String()),
        }),
    })

    .post('/meeting/join', async ({ body, request, set }) => {
        const session = parseSessionFromCookie(request.headers.get('cookie'));
        if (!session) return (set.status = 401, { error: 'Unauthorized' });

        const preset = await getPresetName(body.presetName);
        const { ok, data } = await dytePost(`/meetings/${body.meetingId}/participants`, {
            name: body.participantName,
            preset_name: preset,
            custom_participant_id: `user-${body.channelId}`,
        });
        if (!ok) return (set.status = 502, { error: 'Failed to join meeting' });

        const authToken = pick(data, ['data', 'token'], ['token']);
        return {
            success: true,
            meetingId: body.meetingId,
            presetName: preset,
            authToken,
            meetingLink: `https://meet.timey.app/${body.meetingId}`,
        };
    }, {
        body: t.Object({
            meetingId: t.String(),
            channelId: t.String(),
            participantName: t.String(),
            presetName: t.Optional(t.String()),
        }),
    })

    .post('/meeting/public/create', async ({ body }) => {
        const { ok, data } = await dytePost('/meetings', {
            title: `${body.eventTitle} — ${body.inviteeName}`,
            preferred_region: 'ap-south-1',
        });
        if (!ok) return { success: false, error: 'Failed to create meeting' };

        const meetingId = pick(data, ['data', 'id'], ['id']);
        return { success: true, meetingId, meetingTitle: body.eventTitle };
    }, {
        body: t.Object({
            eventTitle: t.String(),
            inviteeName: t.String(),
            orgName: t.Optional(t.String()),
        }),
    })

    .post('/invite/create', async ({ body, request, set }) => {
        const session = parseSessionFromCookie(request.headers.get('cookie'));
        if (!session) return (set.status = 401, { error: 'Unauthorized' });

        const expiresAt = body.scheduledAt + 24 * 60 * 60 * 1000;
        const payload: InvitePayload = {
            version: 1,
            kind: 'public_meeting',
            dyteMeetingId: body.meetingId,
            orgId: body.orgId,
            title: body.title,
            scheduledAt: body.scheduledAt,
            expiresAt,
        };
        const token = signInvite(payload);
        const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
        return {
            success: true,
            token,
            inviteUrl: `${APP_URL}/meetings/invite/${token}`,
            expiresAt,
        };
    }, {
        body: t.Object({
            meetingId: t.String(),
            orgId: t.String(),
            title: t.String(),
            scheduledAt: t.Number(),
        }),
    })

    .post('/invite/inspect', ({ body, set }) => {
        const payload = verifyInvite(body.token);
        if (!payload) return (set.status = 400, { error: 'Invalid or expired invite' });
        if (payload.expiresAt < Date.now()) return (set.status = 400, { error: 'Invite has expired' });
        return { success: true, title: payload.title, scheduledAt: payload.scheduledAt, expiresAt: payload.expiresAt };
    }, {
        body: t.Object({ token: t.String() }),
    })

    .post('/invite/join', async ({ body, set }) => {
        const payload = verifyInvite(body.token);
        if (!payload) return (set.status = 400, { error: 'Invalid or expired invite' });

        const now = Date.now();
        if (payload.expiresAt < now) return (set.status = 400, { error: 'Invite has expired' });
        const openAt = payload.scheduledAt - 10 * 60 * 1000;
        if (now < openAt) return (set.status = 400, { error: `Meeting opens at ${new Date(openAt).toISOString()}` });

        const guestId = crypto.randomUUID();
        const { ok, data } = await dytePost(`/meetings/${payload.dyteMeetingId}/participants`, {
            name: body.guestName,
            preset_name: GUEST_PRESET,
            custom_participant_id: `guest-${guestId}`,
        });
        if (!ok) return (set.status = 502, { error: 'Failed to join meeting' });

        const authToken = pick(data, ['data', 'token'], ['token']);
        return {
            success: true,
            title: payload.title,
            scheduledAt: payload.scheduledAt,
            authToken,
            meetingLink: `https://meet.timey.app/${payload.dyteMeetingId}`,
        };
    }, {
        body: t.Object({ token: t.String(), guestName: t.String() }),
    });
