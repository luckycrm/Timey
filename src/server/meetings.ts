/**
 * Meeting emails — delegates to Elysia API server.
 * Drop-in replacement for TanStack server functions.
 */
import { api } from '../lib/api';

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

export async function sendMeetingEmail(opts: { data: MeetingEmailInput }) {
    return api<{ success: boolean; error?: string; skippedEmail?: boolean }>(
        '/api/email/meeting',
        { body: opts.data },
    );
}
