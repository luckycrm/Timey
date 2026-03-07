import { createServerFn } from '@tanstack/react-start';
import { SendMailClient } from 'zeptomail';

const ZEPTOMAIL_URL = process.env.ZEPTOMAIL_URL || 'https://api.zeptomail.com/v1.1/email';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@timey.app';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

type MeetingEmailKind =
    | 'scheduled_notice'
    | 'reminder_notice'
    | 'booking_requested'
    | 'booking_confirmed'
    | 'booking_rejected'
    | 'booking_rescheduled'
    | 'booking_cancelled'
    | 'followup_nudge';

interface MeetingEmailPayload {
    kind: MeetingEmailKind;
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

function getMailClient(): SendMailClient | null {
    const token = process.env.ZEPTOMAIL_TOKEN;
    if (!token) return null;
    return new SendMailClient({
        url: ZEPTOMAIL_URL,
        token,
    });
}

function safeFormatDate(timestamp: number, timezone?: string): string {
    const date = new Date(timestamp);
    const baseOptions: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };

    if (timezone && timezone.trim().length > 0) {
        try {
            return new Intl.DateTimeFormat(undefined, { ...baseOptions, timeZone: timezone }).format(date);
        } catch {
            return date.toLocaleString(undefined, baseOptions);
        }
    }

    return date.toLocaleString(undefined, baseOptions);
}

function toUtcIcsDate(timestamp: number): string {
    return new Date(timestamp)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function shouldAttachIcs(kind: MeetingEmailKind): boolean {
    return kind === 'scheduled_notice' || kind === 'reminder_notice' || kind === 'booking_confirmed' || kind === 'booking_rescheduled';
}

function buildMeetingInviteIcs(payload: {
    uid: string;
    title: string;
    description: string;
    location: string;
    startsAt: number;
    endsAt: number;
}): string {
    const dtstamp = toUtcIcsDate(Date.now());
    const dtstart = toUtcIcsDate(payload.startsAt);
    const dtend = toUtcIcsDate(payload.endsAt);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Timey//Meetings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${payload.uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeIcsText(payload.title)}`,
        `DESCRIPTION:${escapeIcsText(payload.description)}`,
        `LOCATION:${escapeIcsText(payload.location)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return `${lines.join('\\r\\n')}\\r\\n`;
}

function buildMeetingEmailCopy(payload: MeetingEmailPayload): {
    subject: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaUrl: string;
} {
    const baseCtaUrl = payload.manageUrl && payload.manageUrl.trim().length > 0
        ? payload.manageUrl.trim()
        : payload.publicUrl && payload.publicUrl.trim().length > 0
            ? payload.publicUrl.trim()
            : APP_URL;

    const eventTitle = payload.eventTitle.trim();
    const orgName = payload.orgName.trim() || 'Workspace';

    switch (payload.kind) {
        case 'scheduled_notice':
            return {
                subject: `New meeting scheduled: ${eventTitle}`,
                title: 'New meeting scheduled',
                subtitle: `${orgName} scheduled ${eventTitle}.`,
                ctaLabel: 'Open Meetings',
                ctaUrl: `${APP_URL}/meetings`,
            };
        case 'reminder_notice':
            return {
                subject: `Reminder: ${eventTitle}`,
                title: 'Meeting reminder',
                subtitle: `Your meeting ${eventTitle} is coming up soon.`,
                ctaLabel: 'Manage booking',
                ctaUrl: baseCtaUrl,
            };
        case 'booking_requested':
            return {
                subject: `Booking request received: ${eventTitle}`,
                title: 'Booking request received',
                subtitle: `Your booking request for ${eventTitle} was submitted and is awaiting host approval.`,
                ctaLabel: 'Manage booking',
                ctaUrl: baseCtaUrl,
            };
        case 'booking_confirmed':
            return {
                subject: `Booking confirmed: ${eventTitle}`,
                title: 'Booking confirmed',
                subtitle: `Your meeting for ${eventTitle} is confirmed.`,
                ctaLabel: 'Manage booking',
                ctaUrl: baseCtaUrl,
            };
        case 'booking_rejected':
            return {
                subject: `Booking declined: ${eventTitle}`,
                title: 'Booking request declined',
                subtitle: `Your booking request for ${eventTitle} was declined.`,
                ctaLabel: 'View booking',
                ctaUrl: baseCtaUrl,
            };
        case 'booking_rescheduled':
            return {
                subject: `Booking updated: ${eventTitle}`,
                title: 'Booking rescheduled',
                subtitle: `Your meeting for ${eventTitle} has a new time.`,
                ctaLabel: 'Manage booking',
                ctaUrl: baseCtaUrl,
            };
        case 'booking_cancelled':
            return {
                subject: `Booking cancelled: ${eventTitle}`,
                title: 'Booking cancelled',
                subtitle: `Your meeting for ${eventTitle} was cancelled.`,
                ctaLabel: 'View booking',
                ctaUrl: baseCtaUrl,
            };
        case 'followup_nudge':
            return {
                subject: `Follow-up resources: ${eventTitle}`,
                title: 'Follow-up from your meeting',
                subtitle: `Here are your follow-up notes and next actions for ${eventTitle}.`,
                ctaLabel: 'Review booking',
                ctaUrl: baseCtaUrl,
            };
        default:
            return {
                subject: `Meeting update: ${eventTitle}`,
                title: 'Meeting updated',
                subtitle: `There is an update for ${eventTitle}.`,
                ctaLabel: 'Open Meetings',
                ctaUrl: `${APP_URL}/meetings`,
            };
    }
}

export const sendMeetingEmail = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const payload = (ctx.data as unknown) as Partial<MeetingEmailPayload>;

        const toEmail = (payload.toEmail || '').trim().toLowerCase();
        const toName = (payload.toName || '').trim() || toEmail.split('@')[0] || 'there';
        const orgName = (payload.orgName || '').trim();
        const eventTitle = (payload.eventTitle || '').trim();
        const startsAt = Number(payload.startsAt || 0);
        const timezone = (payload.timezone || '').trim();
        const notes = (payload.notes || '').trim();
        const oldStartsAt = Number(payload.oldStartsAt || 0);
        const durationMin = Number(payload.durationMin || 30);

        const kind = payload.kind as MeetingEmailKind;
        const allowedKinds: MeetingEmailKind[] = [
            'scheduled_notice',
            'reminder_notice',
            'booking_requested',
            'booking_confirmed',
            'booking_rejected',
            'booking_rescheduled',
            'booking_cancelled',
            'followup_nudge',
        ];

        if (!allowedKinds.includes(kind)) {
            return { success: false, error: 'Invalid meeting email type' };
        }
        if (!toEmail || !toEmail.includes('@')) {
            return { success: false, error: 'Invalid recipient email address' };
        }
        if (!eventTitle) {
            return { success: false, error: 'Meeting title is required' };
        }
        if (!Number.isFinite(startsAt) || startsAt <= 0) {
            return { success: false, error: 'Meeting start time is required' };
        }

        const copy = buildMeetingEmailCopy({
            kind,
            toEmail,
            toName,
            orgName,
            eventTitle,
            startsAt,
            timezone,
            notes,
            manageUrl: payload.manageUrl,
            publicUrl: payload.publicUrl,
            joinContext: payload.joinContext,
            oldStartsAt,
            durationMin,
        });

        const whenLabel = safeFormatDate(startsAt, timezone);
        const oldWhenLabel = Number.isFinite(oldStartsAt) && oldStartsAt > 0
            ? safeFormatDate(oldStartsAt, timezone)
            : null;
        const validDurationMin = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 30;
        const endsAt = startsAt + validDurationMin * 60 * 1000;
        const locationLabel = payload.joinContext && payload.joinContext.trim().length > 0
            ? payload.joinContext.trim()
            : `${APP_URL}/meetings`;

        const inviteAttachment = shouldAttachIcs(kind)
            ? (() => {
                const inviteContent = buildMeetingInviteIcs({
                    uid: `timey-${Math.abs(startsAt)}-${toEmail}@timey.local`,
                    title: `${orgName || 'Workspace'} • ${eventTitle}`,
                    description: notes || copy.subtitle,
                    location: locationLabel,
                    startsAt,
                    endsAt,
                });
                return {
                    name: 'invite.ics',
                    mime_type: 'text/calendar',
                    content: Buffer.from(inviteContent, 'utf-8').toString('base64'),
                };
            })()
            : null;

        const mailClient = getMailClient();
        if (!mailClient) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('ZEPTOMAIL_TOKEN is not configured; skipping meeting email send in development.');
                return { success: true, skippedEmail: true };
            }
            return { success: false, error: 'Email delivery is not configured. Please contact support.' };
        }

        try {
            await mailClient.sendMail({
                from: {
                    address: SENDER_EMAIL,
                    name: 'Timey Meetings',
                },
                to: [
                    {
                        email_address: {
                            address: toEmail,
                            name: toName,
                        },
                    },
                ],
                subject: copy.subject,
                attachments: inviteAttachment ? [inviteAttachment] : undefined,
                htmlbody: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #e7ecef; border-radius: 16px; background: #ffffff;">
                        <h2 style="color: #102028; margin: 0 0 8px 0; font-size: 24px;">${copy.title}</h2>
                        <p style="color: #41555f; line-height: 1.55; margin: 0 0 18px 0;">${copy.subtitle}</p>

                        <div style="background: #f5f8f8; border: 1px solid #dce7e8; border-radius: 12px; padding: 14px; margin-bottom: 18px;">
                            <p style="margin: 0; color: #1f2f36; font-size: 13px;"><strong>Organization:</strong> ${orgName || 'Workspace'}</p>
                            <p style="margin: 6px 0 0 0; color: #1f2f36; font-size: 13px;"><strong>Meeting:</strong> ${eventTitle}</p>
                            <p style="margin: 6px 0 0 0; color: #1f2f36; font-size: 13px;"><strong>When:</strong> ${whenLabel}${timezone ? ` (${timezone})` : ''}</p>
                            ${oldWhenLabel ? `<p style="margin: 6px 0 0 0; color: #1f2f36; font-size: 13px;"><strong>Previous time:</strong> ${oldWhenLabel}${timezone ? ` (${timezone})` : ''}</p>` : ''}
                            ${notes ? `<p style="margin: 8px 0 0 0; color: #43545b; font-size: 12px;"><strong>Notes:</strong> ${notes}</p>` : ''}
                        </div>

                        <div style="text-align: center; margin-bottom: 16px;">
                            <a href="${copy.ctaUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 13px;">
                                ${copy.ctaLabel}
                            </a>
                        </div>

                        <p style="color: #7a8a92; font-size: 12px; line-height: 1.45; margin: 0; text-align: center;">
                            Join opens 10 minutes before scheduled time in Timey.
                        </p>
                    </div>
                `,
            });

            return { success: true };
        } catch (error) {
            console.error('Failed to send meeting email:', error);
            return { success: false, error: 'Failed to deliver meeting email' };
        }
    });
