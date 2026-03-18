import crypto from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET ?? (() => {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET env var required in production');
    console.warn('[session] Using insecure dev secret — set SESSION_SECRET in production');
    return 'timey-dev-session-secret';
})();

interface SessionData {
    email: string;
    verified: boolean;
    loginAt: number;
}

function sign(payload: string): string {
    return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

export function createSessionToken(email: string): string {
    const data: SessionData = { email, verified: true, loginAt: Date.now() };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): SessionData | null {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = sign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64').toString()) as SessionData;
        if (!data.email || !data.verified) return null;
        return data;
    } catch {
        return null;
    }
}

export function parseSessionFromCookie(cookieHeader: string | null): SessionData | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)timey_session=([^;]+)/);
    if (!match) return null;
    try {
        return verifySessionToken(decodeURIComponent(match[1]));
    } catch {
        return null;
    }
}
