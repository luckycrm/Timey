import { Elysia, t } from 'elysia';
import { sendEmail } from '../lib/email';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// ─── iCalendar helpers ────────────────────────────────────────────────────────

function icsEscape(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toIcsDate(ms: number): string {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function makeIcs(opts: { uid: string; title: string; startsAt: number; durationMin: number; description?: string; location?: string }): string {
    const start = toIcsDate(opts.startsAt);
    const end = toIcsDate(opts.startsAt + opts.durationMin * 60_000);
    const now = toIcsDate(Date.now());
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Timey//Timey//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${opts.uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${icsEscape(opts.title)}`,
        opts.description ? `DESCRIPTION:${icsEscape(opts.description)}` : '',
        opts.location ? `LOCATION:${icsEscape(opts.location)}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
}

// ─── Email builders ───────────────────────────────────────────────────────────

function formatDate(ms: number, timezone?: string): string {
    try {
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'full', timeStyle: 'short',
            timeZone: timezone ?? 'UTC',
        }).format(new Date(ms));
    } catch {
        return new Date(ms).toUTCString();
    }
}

function btn(label: string, url: string): string {
    return `<a href="${url}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">${label}</a>`;
}

type EmailKind =
    | 'scheduled_notice'
    | 'reminder_notice'
    | 'booking_requested'
    | 'booking_confirmed'
    | 'booking_rejected'
    | 'booking_rescheduled'
    | 'booking_cancelled'
    | 'followup_nudge';

interface MeetingEmailInput {
    kind: EmailKind;
    toEmail: string;
    toName?: string;
    orgName: string;
    eventTitle: string;
    startsAt: number;
    timezone?: string;
    notes?: string;
    manageUrl?: string;
    publicUrl?: string;
    joinContext?: string;
    oldStartsAt?: number;
    durationMin?: number;
}

const SUBJECTS: Record<EmailKind, (i: MeetingEmailInput) => string> = {
    scheduled_notice: (i) => `Meeting scheduled: ${i.eventTitle}`,
    reminder_notice: (i) => `Reminder: ${i.eventTitle} is coming up`,
    booking_requested: (i) => `New booking request: ${i.eventTitle}`,
    booking_confirmed: (i) => `Booking confirmed: ${i.eventTitle}`,
    booking_rejected: (i) => `Booking declined: ${i.eventTitle}`,
    booking_rescheduled: (i) => `Meeting rescheduled: ${i.eventTitle}`,
    booking_cancelled: (i) => `Meeting cancelled: ${i.eventTitle}`,
    followup_nudge: (i) => `Follow-up: ${i.eventTitle}`,
};

const NEEDS_ICS: Set<EmailKind> = new Set(['scheduled_notice', 'reminder_notice', 'booking_confirmed', 'booking_rescheduled']);

function buildHtml(i: MeetingEmailInput): string {
    const when = formatDate(i.startsAt, i.timezone);
    const ctaUrl = i.manageUrl ?? i.publicUrl ?? `${APP_URL}/meetings`;
    const ctaLabel =
        i.kind === 'booking_requested' ? 'Review request' :
        i.kind === 'booking_confirmed' ? 'Join meeting' :
        'Manage';

    const header: Record<EmailKind, string> = {
        scheduled_notice: 'Meeting scheduled',
        reminder_notice: '⏰ Reminder',
        booking_requested: 'New booking request',
        booking_confirmed: '✅ Booking confirmed',
        booking_rejected: 'Booking declined',
        booking_rescheduled: 'Meeting rescheduled',
        booking_cancelled: 'Meeting cancelled',
        followup_nudge: 'Follow-up resources',
    };

    let extra = '';
    if (i.kind === 'booking_rescheduled' && i.oldStartsAt) {
        extra = `<p>Previously: <s>${formatDate(i.oldStartsAt, i.timezone)}</s></p>`;
    }

    return `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#111">
  <p style="color:#666;font-size:13px">${i.orgName}</p>
  <h2>${header[i.kind]}</h2>
  <h3 style="margin-top:0">${i.eventTitle}</h3>
  <p><strong>When:</strong> ${when}</p>
  ${extra}
  ${i.notes ? `<p><strong>Notes:</strong> ${i.notes}</p>` : ''}
  ${i.kind !== 'booking_rejected' && i.kind !== 'booking_cancelled' ? `<p>${btn(ctaLabel, ctaUrl)}</p>` : ''}
  ${i.joinContext ? `<p style="color:#666;font-size:13px">${i.joinContext}</p>` : ''}
</div>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const emailRoutes = new Elysia({ prefix: '/api/email' })

    .post('/meeting', async ({ body, set }) => {
        try {
            const input = body as MeetingEmailInput;
            if (!input.toEmail?.includes('@')) return (set.status = 400, { error: 'Invalid email' });
            if (!input.eventTitle?.trim()) return (set.status = 400, { error: 'eventTitle required' });

            const attachments: { name: string; content: string; mimeType: string }[] = [];
            if (NEEDS_ICS.has(input.kind)) {
                const uid = `timey-${Math.abs(input.startsAt)}-${input.toEmail}@timey.local`;
                const ics = makeIcs({
                    uid, title: input.eventTitle, startsAt: input.startsAt,
                    durationMin: input.durationMin ?? 60,
                    description: input.notes,
                    location: input.joinContext,
                });
                attachments.push({
                    name: 'invite.ics',
                    content: Buffer.from(ics).toString('base64'),
                    mimeType: 'text/calendar',
                });
            }

            await sendEmail({
                to: input.toEmail,
                toName: input.toName,
                subject: SUBJECTS[input.kind](input),
                html: buildHtml(input),
                attachments,
            });

            return { success: true };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return (set.status = 502, { error: msg });
        }
    }, {
        body: t.Object({
            kind: t.String(),
            toEmail: t.String(),
            toName: t.Optional(t.String()),
            orgName: t.String(),
            eventTitle: t.String(),
            startsAt: t.Number(),
            timezone: t.Optional(t.String()),
            notes: t.Optional(t.String()),
            manageUrl: t.Optional(t.String()),
            publicUrl: t.Optional(t.String()),
            joinContext: t.Optional(t.String()),
            oldStartsAt: t.Optional(t.Number()),
            durationMin: t.Optional(t.Number()),
        }),
    })

    .post('/invite', async ({ body, set }) => {
        try {
            const APP_URL_EFFECTIVE = process.env.APP_URL ?? 'http://localhost:5173';
            await sendEmail({
                to: body.email,
                subject: `You've been invited to join ${body.orgName} on Timey`,
                html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#111">
  <h2>You're invited to join ${body.orgName}</h2>
  <p>Use this workspace ID to join:</p>
  <p style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#000">${body.token}</p>
  <p><a href="${APP_URL_EFFECTIVE}/login" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Join now</a></p>
</div>`,
            });
            return { success: true };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (process.env.NODE_ENV !== 'production') return { success: true, skippedEmail: true };
            return (set.status = 502, { error: msg });
        }
    }, {
        body: t.Object({
            email: t.String(),
            orgName: t.String(),
            token: t.String(),
        }),
    });
