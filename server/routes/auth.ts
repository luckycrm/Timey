import { Elysia, t } from 'elysia';
import crypto from 'node:crypto';
import { createSessionToken, verifySessionToken, parseSessionFromCookie } from '../lib/session';
import { sendEmail } from '../lib/email';

interface OtpEntry {
    code: string;
    expiresAt: number;
    attempts: number;
    createdAt: number;
}

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REUSE_WINDOW_MS = 60 * 1000;

function generateOtp(): string {
    return String(crypto.randomInt(100000, 999999));
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function pruneExpiredOtps() {
    const now = Date.now();
    for (const [key, entry] of otpStore) {
        if (entry.expiresAt < now) otpStore.delete(key);
    }
}

export const authRoutes = new Elysia({ prefix: '/api/auth' })

    .post('/otp/request', async ({ body, set }) => {
        pruneExpiredOtps();
        const email = normalizeEmail(body.email);
        if (!email.includes('@')) return set.status = 400, { error: 'Invalid email' };

        const existing = otpStore.get(email);
        const now = Date.now();

        // Reuse if requested within reuse window
        if (existing && existing.expiresAt > now && now - existing.createdAt < OTP_REUSE_WINDOW_MS) {
            if (process.env.NODE_ENV !== 'production') {
                return { success: true, devCode: existing.code };
            }
            return { success: true };
        }

        const code = generateOtp();
        otpStore.set(email, { code, expiresAt: now + OTP_TTL_MS, attempts: 0, createdAt: now });

        try {
            await sendEmail({
                to: email,
                subject: 'Your Timey Login Code',
                html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
  <h2>Your login code</h2>
  <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#000">${code}</p>
  <p>This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
</div>`,
            });
        } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[auth:dev] OTP for ${email}: ${code}`);
                return { success: true, devCode: code };
            }
            return (set.status = 500, { error: 'Failed to send email' });
        }

        if (process.env.NODE_ENV !== 'production') {
            return { success: true, devCode: code };
        }
        return { success: true };
    }, {
        body: t.Object({ email: t.String() }),
    })

    .post('/otp/verify', ({ body, cookie, set }) => {
        const email = normalizeEmail(body.email);
        const code = body.code.replace(/\D/g, '');
        const entry = otpStore.get(email);
        const now = Date.now();

        if (!entry || entry.expiresAt < now) {
            return (set.status = 400, { error: 'Code expired or not found. Request a new one.' });
        }
        if (entry.attempts >= OTP_MAX_ATTEMPTS) {
            return (set.status = 400, { error: 'Too many attempts. Request a new code.' });
        }

        entry.attempts++;
        if (entry.code !== code) {
            return (set.status = 400, { error: 'Invalid code' });
        }

        otpStore.delete(email);
        const token = createSessionToken(email);

        cookie.timey_session.set({
            value: encodeURIComponent(token),
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            secure: process.env.NODE_ENV === 'production',
        });

        return { success: true, email };
    }, {
        body: t.Object({ email: t.String(), code: t.String() }),
    })

    .get('/session', ({ cookie }) => {
        const raw = cookie.timey_session?.value;
        if (!raw) return { authenticated: false };
        try {
            const session = verifySessionToken(decodeURIComponent(raw));
            if (!session) return { authenticated: false };
            return { authenticated: true, email: session.email };
        } catch {
            return { authenticated: false };
        }
    })

    .post('/logout', ({ cookie }) => {
        cookie.timey_session.set({ value: '', path: '/', maxAge: 0 });
        return { success: true };
    });
