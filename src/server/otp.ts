import { createServerFn } from '@tanstack/react-start';
import { SendMailClient } from 'zeptomail';
import {
    createSessionToken,
    parseSessionFromCookie,
} from './session';
import { getRequest, setCookie } from '@tanstack/react-start/server';

// ─── OTP Store (in-memory, single server) ────────────────────────────
interface OtpEntry {
    code: string;
    expiresAt: number;
    attempts: number;
    issuedAt: number;
}

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const OTP_REUSE_WINDOW = 60 * 1000; // 60 seconds

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanExpiredOtps() {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
        if (entry.expiresAt < now) {
            otpStore.delete(key);
        }
    }
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeCode(code: string): string {
    return code.replace(/\D/g, '').slice(0, 6);
}

// ─── ZeptoMail Client ────────────────────────────────────────────────
const ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
const ZEPTOMAIL_TOKEN =
    process.env.ZEPTOMAIL_TOKEN ||
    'Zoho-enczapikey wSsVR61z/EKmX68pmj2kJOw6kFoEUVrxHUoo0Frz73/+GK/KosdtxBLHAATySPEXRGZtE2MVoL4tnUgG2mIGiox5m1tSDCiF9mqRe1U4J3x17qnvhDzMX2pdlhSKKIMMwA1rmGRmGskq+g==';

const mailClient = new SendMailClient({
    url: ZEPTOMAIL_URL,
    token: ZEPTOMAIL_TOKEN,
});

// ─── Server Functions ────────────────────────────────────────────────

/**
 * Request an OTP code for the given email
 */
export const requestOtp = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const { email: rawEmail } = (ctx.data as any) as { email: string };
        const email = normalizeEmail(rawEmail ?? '');

        if (!email || !email.includes('@')) {
            return { success: false, error: 'Invalid email address' };
        }

        // Clean expired OTPs
        cleanExpiredOtps();

        const now = Date.now();
        const existingEntry = otpStore.get(email);
        const shouldReuseCode =
            !!existingEntry &&
            existingEntry.expiresAt >= now &&
            now - existingEntry.issuedAt <= OTP_REUSE_WINDOW;

        // Reuse the same code for rapid repeated requests to avoid invalidating
        // the first email when users double-submit.
        const code = shouldReuseCode ? existingEntry.code : generateOtp();
        otpStore.set(email, {
            code,
            expiresAt: now + OTP_TTL,
            attempts: 0,
            issuedAt: now,
        });

        // Send email via ZeptoMail
        try {
            await mailClient.sendMail({
                from: {
                    address: 'noreply@bootserp.com',
                    name: 'Timey',
                },
                to: [
                    {
                        email_address: {
                            address: email,
                            name: email.split('@')[0],
                        },
                    },
                ],
                subject: 'Your Timey Login Code',
                htmlbody: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a2e; margin-bottom: 8px;">Your login code</h2>
            <p style="color: #666; margin-bottom: 24px;">Enter this code to sign in to Timey:</p>
            <div style="background: #f0f0f5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e;">${code}</span>
            </div>
            <p style="color: #999; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `,
            });

            console.log(`OTP sent to ${email}: ${code}`);
            return { success: true };
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            if (process.env.NODE_ENV === 'development') {
                console.log(`[DEV] OTP for ${email}: ${code}`);
                return { success: true, devCode: code };
            }

            otpStore.delete(email);
            return { success: false, error: 'Failed to send access code. Please try again.' };
        }
    });

/**
 * Verify an OTP code and create a session
 */
export const verifyOtp = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const { email, code } = (ctx.data as any) as { email: string; code: string };
        const normalizedEmail = normalizeEmail(email ?? '');
        const normalizedCode = normalizeCode(code ?? '');

        const entry = otpStore.get(normalizedEmail);

        if (!entry) {
            return { success: false, error: 'No OTP requested for this email. Please request a new code.' };
        }

        if (entry.expiresAt < Date.now()) {
            otpStore.delete(normalizedEmail);
            return { success: false, error: 'OTP has expired. Please request a new code.' };
        }

        if (entry.attempts >= MAX_ATTEMPTS) {
            otpStore.delete(normalizedEmail);
            return { success: false, error: 'Too many attempts. Please request a new code.' };
        }

        if (normalizedCode.length !== 6) {
            return { success: false, error: 'Invalid code format.' };
        }

        if (entry.code !== normalizedCode) {
            entry.attempts++;
            if (entry.attempts >= MAX_ATTEMPTS) {
                otpStore.delete(normalizedEmail);
                return { success: false, error: 'Too many attempts. Please request a new code.' };
            }
            return { success: false, error: `Invalid code. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.` };
        }

        // OTP is valid — clean up and create session
        otpStore.delete(normalizedEmail);

        const token = createSessionToken(normalizedEmail);
        setCookie('timey_session', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return { success: true, email: normalizedEmail };
    });

/**
 * Get the current session (if any)
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
    async () => {
        const request = getRequest();
        const cookieHeader = request.headers.get('cookie');
        const session = parseSessionFromCookie(cookieHeader);

        console.log('[getSession] Request cookies:', cookieHeader);
        console.log('[getSession] Parsed session:', session);

        if (!session) {
            return { authenticated: false, email: null };
        }

        return { authenticated: true, email: session.email };
    }
);

/**
 * Logout — clear session cookie
 */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    setCookie('timey_session', '', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 0,
    });
    return { success: true };
});
