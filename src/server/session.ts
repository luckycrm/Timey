import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'timey_session';
const DEV_FALLBACK_SECRET = 'timey-dev-session-secret';
let hasWarnedMissingSecret = false;

export interface SessionData {
    email: string;
    verified: boolean;
    loginAt: number;
}

function sign(data: string): string {
    const secret = SESSION_SECRET || (
        process.env.NODE_ENV !== 'production'
            ? DEV_FALLBACK_SECRET
            : null
    );

    if (!secret) {
        throw new Error('SESSION_SECRET environment variable is required');
    }

    if (!SESSION_SECRET && !hasWarnedMissingSecret) {
        hasWarnedMissingSecret = true;
        console.warn('SESSION_SECRET is not configured; using an insecure development fallback secret.');
    }

    return createHmac('sha256', secret).update(data).digest('hex');
}

export function createSessionToken(email: string): string {
    const data: SessionData = {
        email,
        verified: true,
        loginAt: Date.now(),
    };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    const signature = sign(payload);
    return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionData | null {
    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) return null;

        const expectedSig = sign(payload);
        if (signature !== expectedSig) return null;

        const data = JSON.parse(
            Buffer.from(payload, 'base64').toString('utf-8')
        ) as SessionData;

        if (!data.email || !data.verified) return null;

        return data;
    } catch {
        return null;
    }
}

export function parseSessionFromCookie(
    cookieHeader: string | null
): SessionData | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
        (acc, cookie) => {
            const [key, ...rest] = cookie.trim().split('=');
            if (key) {
                const value = rest.join('=');
                try {
                    acc[decodeURIComponent(key)] = decodeURIComponent(value);
                } catch {
                    acc[key] = value;
                }
            }
            return acc;
        },
        {} as Record<string, string>
    );

    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    return verifySessionToken(token);
}
