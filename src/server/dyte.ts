import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import crypto from 'node:crypto';
import { parseSessionFromCookie } from './session';

const DYTE_BASE_URL = process.env.DYTE_BASE_URL || 'https://api.cluster.dyte.in/v2';
const DEFAULT_PRESET_NAME = process.env.DYTE_PRESET_NAME || 'group_call_host';

interface CreateDyteMeetingAccessInput {
    channelId: string;
    channelName: string;
    participantName: string;
    orgName?: string;
    presetName?: string;
}

interface JoinDyteMeetingAccessInput {
    meetingId: string;
    channelId: string;
    participantName: string;
    presetName?: string;
}

interface CreatePublicDyteMeetingInput {
    orgName?: string;
    eventTitle: string;
    inviteeName: string;
}

interface CreatePublicMeetingInviteInput {
    meetingId: string;
    orgId: string;
    title: string;
    scheduledAt: number;
}

interface InspectPublicMeetingInviteInput {
    token: string;
}

interface JoinPublicMeetingInviteInput {
    token: string;
    guestName: string;
}

type PublicMeetingInvitePayload = {
    version: 1;
    kind: 'public_meeting';
    dyteMeetingId: string;
    orgId: string;
    title: string;
    scheduledAt: number;
    expiresAt: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value == null) return null;
    return value as Record<string, unknown>;
}

function readStringAtPath(value: unknown, path: string[]): string | null {
    let cursor: unknown = value;
    for (const segment of path) {
        const record = asRecord(cursor);
        if (!record) return null;
        cursor = record[segment];
    }
    return typeof cursor === 'string' && cursor.trim().length > 0 ? cursor.trim() : null;
}

function pickFirstString(value: unknown, paths: string[][]): string | null {
    for (const path of paths) {
        const candidate = readStringAtPath(value, path);
        if (candidate) return candidate;
    }
    return null;
}

function createDyteAuthHeader(): string | null {
    const apiKey = process.env.DYTE_API_KEY;
    const orgId = process.env.DYTE_ORG_ID;
    if (!apiKey || !orgId) return null;
    return `Basic ${Buffer.from(`${orgId}:${apiKey}`, 'utf-8').toString('base64')}`;
}

function getMeetingInviteSecret(): string {
    const secret = process.env.MEETING_LINK_SECRET || process.env.SESSION_SECRET;
    if (!secret || !secret.trim()) {
        throw new Error('Meeting links are not configured. Add MEETING_LINK_SECRET or SESSION_SECRET.');
    }
    return secret.trim();
}

function signInvitePayload(encodedPayload: string): string {
    const secret = getMeetingInviteSecret();
    return crypto
        .createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64url');
}

function encodeInvitePayload(payload: PublicMeetingInvitePayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeInviteToken(token: string): PublicMeetingInvitePayload {
    const [encodedPayload, signature] = token.trim().split('.');
    if (!encodedPayload || !signature) {
        throw new Error('Invalid invite link');
    }

    const expected = signInvitePayload(encodedPayload);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (
        expectedBuffer.length !== actualBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
        throw new Error('Invite link is not valid');
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as Partial<PublicMeetingInvitePayload>;
    if (
        parsed.version !== 1 ||
        parsed.kind !== 'public_meeting' ||
        typeof parsed.dyteMeetingId !== 'string' ||
        typeof parsed.orgId !== 'string' ||
        typeof parsed.title !== 'string' ||
        typeof parsed.scheduledAt !== 'number' ||
        typeof parsed.expiresAt !== 'number'
    ) {
        throw new Error('Invite link payload is invalid');
    }

    if (Date.now() > parsed.expiresAt) {
        throw new Error('Invite link has expired');
    }

    return parsed as PublicMeetingInvitePayload;
}

async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

async function dyteRequest(path: string, init: RequestInit): Promise<unknown> {
    const authHeader = createDyteAuthHeader();
    if (!authHeader) {
        throw new Error('Dyte is not configured. Add DYTE_ORG_ID and DYTE_API_KEY.');
    }

    const response = await fetch(`${DYTE_BASE_URL}${path}`, {
        ...init,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
        const errorMessage = pickFirstString(body, [
            ['error', 'message'],
            ['message'],
            ['error'],
        ]) || `Dyte request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    return body;
}

function extractPresetNames(payload: unknown): string[] {
    const values: unknown[] = [];
    const root = asRecord(payload);
    if (Array.isArray(payload)) values.push(...payload);
    if (root) {
        const directData = root.data;
        if (Array.isArray(directData)) values.push(...directData);
        const presets = root.presets;
        if (Array.isArray(presets)) values.push(...presets);
    }

    const uniqueNames = new Set<string>();
    for (const item of values) {
        const itemRecord = asRecord(item);
        if (!itemRecord) continue;
        const name = typeof itemRecord.name === 'string'
            ? itemRecord.name
            : (typeof itemRecord.preset_name === 'string' ? itemRecord.preset_name : null);
        if (name && name.trim()) uniqueNames.add(name.trim());
    }
    return [...uniqueNames];
}

async function resolvePresetName(explicitPresetName: string | undefined): Promise<string> {
    if (explicitPresetName && explicitPresetName.trim()) {
        return explicitPresetName.trim();
    }
    if (DEFAULT_PRESET_NAME.trim()) {
        return DEFAULT_PRESET_NAME.trim();
    }

    const presetsResponse = await dyteRequest('/presets', { method: 'GET' });
    const presets = extractPresetNames(presetsResponse);
    if (presets.length > 0) {
        return presets[0];
    }

    throw new Error('No Dyte preset found. Create one in Dyte dashboard and set DYTE_PRESET_NAME.');
}

async function createParticipantAccess(args: {
    meetingId: string;
    channelId: string;
    participantName: string;
    participantKey: string;
    presetName?: string;
}) {
    const presetName = await resolvePresetName(args.presetName);
    const clientSpecificId = `timey::${args.channelId}::${args.participantKey}::${Date.now().toString(36)}`
        .replace(/[^a-zA-Z0-9._:-]/g, '-')
        .slice(0, 120);

    const participantResponse = await dyteRequest(`/meetings/${encodeURIComponent(args.meetingId)}/participants`, {
        method: 'POST',
        body: JSON.stringify({
            name: args.participantName,
            preset_name: presetName,
            client_specific_id: clientSpecificId,
        }),
    });

    const authToken = pickFirstString(participantResponse, [
        ['data', 'auth_token'],
        ['data', 'authToken'],
        ['data', 'token'],
        ['data', 'auth_response', 'auth_token'],
        ['auth_token'],
        ['authToken'],
        ['token'],
    ]);

    if (!authToken) {
        throw new Error('Dyte participant token was not returned.');
    }

    const meetingLink = pickFirstString(participantResponse, [
        ['data', 'meeting_link'],
        ['data', 'meetingLink'],
        ['meeting_link'],
        ['meetingLink'],
    ]);

    return {
        authToken,
        meetingLink,
        presetName,
    };
}

export const createDyteMeetingAccess = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const request = getRequest();
        const cookieHeader = request.headers.get('cookie');
        const session = parseSessionFromCookie(cookieHeader);
        if (!session) {
            return { success: false, error: 'Unauthorized. Please sign in again.' };
        }

        const input = (ctx.data as unknown) as Partial<CreateDyteMeetingAccessInput>;
        const channelId = typeof input.channelId === 'string' ? input.channelId.trim() : '';
        const channelName = typeof input.channelName === 'string' ? input.channelName.trim() : '';
        const participantName = typeof input.participantName === 'string' ? input.participantName.trim() : '';
        const orgName = typeof input.orgName === 'string' ? input.orgName.trim() : '';

        if (!channelId || !channelName || !participantName) {
            return { success: false, error: 'Missing channel or participant details for call.' };
        }

        try {
            const meetingTitle = `${orgName || 'Workspace'} • ${channelName}`.slice(0, 120);
            const meetingResponse = await dyteRequest('/meetings', {
                method: 'POST',
                body: JSON.stringify({ title: meetingTitle }),
            });

            const meetingId = pickFirstString(meetingResponse, [
                ['data', 'id'],
                ['id'],
                ['data', 'meeting_id'],
                ['meeting_id'],
            ]);

            if (!meetingId) {
                return { success: false, error: 'Failed to create Dyte meeting.' };
            }

            const access = await createParticipantAccess({
                meetingId,
                channelId,
                participantName,
                participantKey: session.email,
                presetName: input.presetName,
            });

            return {
                success: true,
                meetingId,
                meetingTitle,
                presetName: access.presetName,
                authToken: access.authToken,
                meetingLink: access.meetingLink,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not start call';
            return { success: false, error: message };
        }
    });

export const createPublicDyteMeetingAccess = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const input = (ctx.data as unknown) as Partial<CreatePublicDyteMeetingInput>;
        const orgName = typeof input.orgName === 'string' ? input.orgName.trim() : '';
        const eventTitle = typeof input.eventTitle === 'string' ? input.eventTitle.trim() : '';
        const inviteeName = typeof input.inviteeName === 'string' ? input.inviteeName.trim() : '';

        if (!eventTitle || !inviteeName) {
            return { success: false, error: 'Missing event title or invitee name.' };
        }

        try {
            const meetingTitle = `${orgName || 'Workspace'} • ${eventTitle}`.slice(0, 120);
            const meetingResponse = await dyteRequest('/meetings', {
                method: 'POST',
                body: JSON.stringify({ title: meetingTitle }),
            });

            const meetingId = pickFirstString(meetingResponse, [
                ['data', 'id'],
                ['id'],
                ['data', 'meeting_id'],
                ['meeting_id'],
            ]);

            if (!meetingId) {
                return { success: false, error: 'Failed to create Dyte meeting.' };
            }

            return {
                success: true,
                meetingId,
                meetingTitle,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not create public meeting';
            return { success: false, error: message };
        }
    });

export const joinDyteMeetingAccess = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const request = getRequest();
        const cookieHeader = request.headers.get('cookie');
        const session = parseSessionFromCookie(cookieHeader);
        if (!session) {
            return { success: false, error: 'Unauthorized. Please sign in again.' };
        }

        const input = (ctx.data as unknown) as Partial<JoinDyteMeetingAccessInput>;
        const meetingId = typeof input.meetingId === 'string' ? input.meetingId.trim() : '';
        const channelId = typeof input.channelId === 'string' ? input.channelId.trim() : '';
        const participantName = typeof input.participantName === 'string' ? input.participantName.trim() : '';

        if (!meetingId || !channelId || !participantName) {
            return { success: false, error: 'Missing meeting details for join.' };
        }

        try {
            const access = await createParticipantAccess({
                meetingId,
                channelId,
                participantName,
                participantKey: session.email,
                presetName: input.presetName,
            });

            return {
                success: true,
                meetingId,
                presetName: access.presetName,
                authToken: access.authToken,
                meetingLink: access.meetingLink,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not join call';
            return { success: false, error: message };
        }
    });

export const createPublicMeetingInviteLink = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const request = getRequest();
        const cookieHeader = request.headers.get('cookie');
        const session = parseSessionFromCookie(cookieHeader);
        if (!session) {
            return { success: false, error: 'Unauthorized. Please sign in again.' };
        }

        const input = (ctx.data as unknown) as Partial<CreatePublicMeetingInviteInput>;
        const meetingId = typeof input.meetingId === 'string' ? input.meetingId.trim() : '';
        const orgId = typeof input.orgId === 'string' ? input.orgId.trim() : '';
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        const scheduledAt = typeof input.scheduledAt === 'number' ? input.scheduledAt : 0;

        if (!meetingId || !orgId || !title || !Number.isFinite(scheduledAt)) {
            return { success: false, error: 'Missing meeting details for public invite.' };
        }

        try {
            const expiresAt = Math.max(
                scheduledAt + 24 * 60 * 60 * 1000,
                Date.now() + 24 * 60 * 60 * 1000
            );
            const payload: PublicMeetingInvitePayload = {
                version: 1,
                kind: 'public_meeting',
                dyteMeetingId: meetingId,
                orgId,
                title,
                scheduledAt,
                expiresAt,
            };
            const encoded = encodeInvitePayload(payload);
            const token = `${encoded}.${signInvitePayload(encoded)}`;
            const origin = new URL(request.url).origin;

            return {
                success: true,
                token,
                inviteUrl: `${origin}/meet/${token}`,
                expiresAt,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not create meeting invite';
            return { success: false, error: message };
        }
    });

export const inspectPublicMeetingInvite = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const input = (ctx.data as unknown) as Partial<InspectPublicMeetingInviteInput>;
        const token = typeof input.token === 'string' ? input.token.trim() : '';
        if (!token) {
            return { success: false, error: 'Invite token is required.' };
        }

        try {
            const payload = decodeInviteToken(token);
            return {
                success: true,
                title: payload.title,
                scheduledAt: payload.scheduledAt,
                expiresAt: payload.expiresAt,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not open invite';
            return { success: false, error: message };
        }
    });

export const joinPublicMeetingInviteAccess = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const input = (ctx.data as unknown) as Partial<JoinPublicMeetingInviteInput>;
        const token = typeof input.token === 'string' ? input.token.trim() : '';
        const guestName = typeof input.guestName === 'string' ? input.guestName.trim() : '';

        if (!token || !guestName) {
            return { success: false, error: 'Guest name and invite token are required.' };
        }

        try {
            const payload = decodeInviteToken(token);
            const joinOpenAt = payload.scheduledAt - 10 * 60 * 1000;
            if (Date.now() < joinOpenAt) {
                return { success: false, error: 'This meeting opens 10 minutes before the scheduled start.' };
            }
            const access = await createParticipantAccess({
                meetingId: payload.dyteMeetingId,
                channelId: `public-${payload.orgId}`,
                participantName: guestName,
                participantKey: `guest:${payload.orgId}:${crypto.randomUUID()}`,
                presetName: process.env.DYTE_GUEST_PRESET_NAME || undefined,
            });

            return {
                success: true,
                title: payload.title,
                scheduledAt: payload.scheduledAt,
                authToken: access.authToken,
                meetingLink: access.meetingLink,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not join meeting';
            return { success: false, error: message };
        }
    });
