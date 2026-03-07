import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import CancelScheduleSendRoundedIcon from '@mui/icons-material/CancelScheduleSendRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { sendMeetingEmail } from '../../server/meetings';
import { createPublicMeetingInviteLink } from '../../server/dyte';
import { reducers, tables } from '../../module_bindings';
import type {
    ChatScheduledMeeting as DbChatScheduledMeeting,
    MeetingBooking as DbMeetingBooking,
    MeetingEventType as DbMeetingEventType,
    Organization as DbOrganization,
    MeetingPublicProfile as DbMeetingPublicProfile,
    User as DbUser,
} from '../../module_bindings/types';
import { meetingsInputSx, meetingsPrimaryButtonSx, meetingsRadius, meetingsSecondaryButtonSx } from './MeetingsUI';
import { chatColors } from '../../theme/chatColors';

type PublicBookingManagePageProps = {
    token: string;
};

const NONE_U64 = 18446744073709551615n;

function normalizeToken(value: string): string {
    return decodeURIComponent(value || '').trim().toLowerCase();
}

function toDateTimeLocalValue(timestampMs: number): string {
    const date = new Date(timestampMs);
    const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    const local = new Date(timestampMs - tzOffsetMs);
    return local.toISOString().slice(0, 16);
}

function formatDateTime(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const pageBgSx = {
    bgcolor: chatColors.pageBg,
    backgroundImage: `radial-gradient(circle at top left, ${alpha(chatColors.textPrimary, 0.12)} 0%, transparent 24%), radial-gradient(circle at top right, ${alpha(chatColors.actionBg, 0.1)} 0%, transparent 18%), linear-gradient(180deg, ${chatColors.pageBg} 0%, #020202 100%)`,
};

const panelSx = {
    borderRadius: meetingsRadius.panel,
    border: `1px solid ${alpha(chatColors.textPrimary, 0.06)}`,
    bgcolor: chatColors.panelBg,
    boxShadow: '0 28px 90px rgba(0,0,0,0.38)',
    backdropFilter: 'blur(22px)',
};

const insetPanelSx = {
    borderRadius: meetingsRadius.card,
    border: 'none',
    bgcolor: chatColors.panelAltBg,
    boxShadow: 'none',
};

const secondaryButtonOverrideSx = {
    px: 1.8,
    borderRadius: meetingsRadius.control,
};

const primaryButtonOverrideSx = {
    minHeight: 44,
    fontSize: '0.9rem',
    borderRadius: meetingsRadius.control,
};

const subtleTextSx = {
    color: chatColors.textSecondary,
    fontSize: '0.8rem',
    lineHeight: 1.6,
};

export function PublicBookingManagePage({ token }: PublicBookingManagePageProps) {
    const navigate = useNavigate();
    const cancelByTokenReducer = useReducer(reducers.cancelMeetingBookingByToken);
    const rescheduleByTokenReducer = useReducer(reducers.rescheduleMeetingBookingByToken);

    const [allBookings] = useSpacetimeDBQuery(tables.meeting_booking);
    const [allEventTypes] = useSpacetimeDBQuery(tables.meeting_event_type);
    const [allProfiles] = useSpacetimeDBQuery(tables.meeting_public_profile);
    const [allOrganizations] = useSpacetimeDBQuery(tables.organization);
    const [allUsers] = useSpacetimeDBQuery(tables.user);
    const [allScheduledMeetings] = useSpacetimeDBQuery(tables.chat_scheduled_meeting);

    const bookings = (allBookings || []) as DbMeetingBooking[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const users = (allUsers || []) as DbUser[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];
    const normalized = normalizeToken(token);

    const booking = useMemo(() => {
        return bookings.find((row) => row.bookingToken.toLowerCase() === normalized) || null;
    }, [bookings, normalized]);

    const eventType = useMemo(() => {
        if (!booking) return null;
        return eventTypes.find((row) => row.id === booking.eventTypeId) || null;
    }, [booking, eventTypes]);

    const hostProfile = useMemo(() => {
        if (!booking) return null;
        return profiles.find((row) => row.userId === booking.hostUserId && row.orgId === booking.orgId) || null;
    }, [booking, profiles]);

    const organization = useMemo(() => {
        if (!booking) return null;
        return organizations.find((row) => row.id === booking.orgId) || null;
    }, [booking, organizations]);

    const hostUser = useMemo(() => {
        if (!booking) return null;
        return users.find((row) => row.id === booking.hostUserId) || null;
    }, [booking, users]);
    const scheduledMeeting = useMemo(() => {
        if (!booking || booking.scheduledMeetingId === NONE_U64) return null;
        return scheduledMeetings.find((row) => row.id === booking.scheduledMeetingId) || null;
    }, [booking, scheduledMeetings]);

    const [rescheduleValue, setRescheduleValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPreparingJoin, setIsPreparingJoin] = useState(false);
    const [activeSection, setActiveSection] = useState<'join' | 'manage'>('join');

    const initialReschedule = booking ? toDateTimeLocalValue(Number(booking.startsAt)) : '';
    const effectiveRescheduleValue = rescheduleValue || initialReschedule;
    const hostName = hostUser?.name || hostProfile?.handle || 'Host';
    const hostInitial = hostName.trim().charAt(0).toUpperCase();
    const statusTone = booking?.status === 'cancelled'
        ? {
            bg: alpha(chatColors.danger, 0.14),
            text: '#ffb5be',
            label: 'Cancelled',
        }
        : booking?.status === 'pending'
            ? {
                bg: alpha(chatColors.warning, 0.16),
                text: '#ffd59a',
                label: 'Awaiting approval',
            }
            : {
                bg: alpha(chatColors.success, 0.16),
                text: '#b7f3cf',
                label: 'Confirmed',
            };

    const isLoading =
        allBookings == null ||
        allEventTypes == null ||
        allProfiles == null ||
        allOrganizations == null ||
        allUsers == null ||
        allScheduledMeetings == null;

    const now = Date.now();
    const joinOpensAt = booking ? Number(booking.startsAt) - 10 * 60 * 1000 : 0;
    const canJoin =
        !!booking &&
        booking.status === 'confirmed' &&
        !!scheduledMeeting &&
        scheduledMeeting.status !== 'cancelled' &&
        now >= joinOpensAt;
    const joinStatusText = !booking
        ? 'Booking not available.'
        : booking.status === 'pending'
            ? 'The host needs to approve this booking before a join link is available.'
            : booking.status === 'cancelled'
                ? 'This booking was cancelled, so the meeting can no longer be joined.'
                : !scheduledMeeting
                    ? 'Meeting access will appear here once the host finalizes the scheduled room.'
                    : scheduledMeeting.status === 'cancelled'
                        ? 'This meeting was cancelled by the host.'
                        : now < joinOpensAt
                            ? 'Join opens 10 minutes before the start time.'
                            : 'The meeting is ready to join.';

    const handleReschedule = async () => {
        if (!booking) return;
        const target = new Date(effectiveRescheduleValue).getTime();
        if (!Number.isFinite(target)) {
            toast.error('Choose a valid date and time');
            return;
        }

        setIsProcessing(true);
        try {
            const oldStartsAt = Number(booking.startsAt);
            await rescheduleByTokenReducer({
                bookingToken: booking.bookingToken,
                startsAt: BigInt(target),
            });
            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_rescheduled',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: organization?.name || 'Workspace',
                        eventTitle: eventType?.title || 'Meeting',
                        startsAt: target,
                        durationMin: Number(eventType?.durationMin || 30n),
                        oldStartsAt,
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                        joinContext: hostUser?.name || hostProfile?.handle || '',
                    } as any,
                });
                if (!emailResult?.success) {
                    console.warn('Meeting email send failed:', emailResult?.error);
                }
            } catch (emailError) {
                console.warn('Meeting email send threw error:', emailError);
            }
            toast.success('Booking rescheduled');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not reschedule booking');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!booking) return;
        setIsProcessing(true);
        try {
            await cancelByTokenReducer({ bookingToken: booking.bookingToken });
            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_cancelled',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: organization?.name || 'Workspace',
                        eventTitle: eventType?.title || 'Meeting',
                        startsAt: Number(booking.startsAt),
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                        joinContext: hostUser?.name || hostProfile?.handle || '',
                    } as any,
                });
                if (!emailResult?.success) {
                    console.warn('Meeting email send failed:', emailResult?.error);
                }
            } catch (emailError) {
                console.warn('Meeting email send threw error:', emailError);
            }
            toast.success('Booking cancelled');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not cancel booking');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleJoinMeeting = async () => {
        if (!booking || !scheduledMeeting) return;
        if (!canJoin) {
            toast.message(joinStatusText);
            return;
        }

        setIsPreparingJoin(true);
        try {
            const result = await createPublicMeetingInviteLink({
                data: {
                    meetingId: scheduledMeeting.dyteMeetingId,
                    orgId: String(booking.orgId),
                    title: scheduledMeeting.title || eventType?.title || 'Meeting',
                    scheduledAt: Number(booking.startsAt),
                } as any,
            });

            if (!result.success || !result.token) {
                throw new Error(result.error || 'Could not open meeting');
            }

            await navigate({
                to: '/meet/$inviteToken',
                params: { inviteToken: result.token },
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not open meeting');
        } finally {
            setIsPreparingJoin(false);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', ...pageBgSx }}>
                <CircularProgress sx={{ color: chatColors.actionBg }} />
            </Box>
        );
    }

    if (!booking) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, ...pageBgSx }}>
                <Paper sx={{ ...panelSx, p: 3, maxWidth: 560, width: '100%' }}>
                    <Stack spacing={1.2}>
                        <Typography sx={{ color: chatColors.textPrimary, fontWeight: 800, fontSize: '1.1rem' }}>
                            Booking link invalid
                        </Typography>
                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.88rem' }}>
                            This booking token is not valid or has expired.
                        </Typography>
                        <Button
                            onClick={() => void navigate({ to: '/' })}
                            startIcon={<ArrowBackRoundedIcon />}
                            sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                        >
                            Back
                        </Button>
                    </Stack>
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', ...pageBgSx }}>
            <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
                <Stack spacing={2}>
                    <Stack spacing={0.8}>
                        <Typography
                            sx={{
                                color: chatColors.textMuted,
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                            }}
                        >
                            Timey Scheduling
                        </Typography>
                        <Typography sx={{ color: chatColors.textPrimary, fontSize: { xs: '1.5rem', md: '1.9rem' }, fontWeight: 800, lineHeight: 1.08 }}>
                            Join or manage your booking with {hostName}
                        </Typography>
                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.88rem', maxWidth: 760, lineHeight: 1.65 }}>
                            Open the guest meeting page when it is time to join, or switch to booking controls if you need to reschedule or cancel.
                        </Typography>
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr)' }, gap: 2 }}>
                        <Paper sx={{ ...panelSx, p: 2, alignSelf: 'start', position: { xl: 'sticky' }, top: { xl: 24 } }}>
                            <Stack spacing={2}>
                                <Stack spacing={1.6}>
                                    <Stack direction="row" spacing={1.2} alignItems="center">
                                        <Avatar
                                            variant="rounded"
                                            sx={{
                                                width: 54,
                                                height: 54,
                                                bgcolor: alpha(chatColors.textPrimary, 0.08),
                                                color: chatColors.textPrimary,
                                                fontWeight: 800,
                                                borderRadius: meetingsRadius.card,
                                            }}
                                        >
                                            {hostInitial}
                                        </Avatar>
                                        <Stack spacing={0.3} sx={{ minWidth: 0 }}>
                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                Hosted by
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '1.02rem', fontWeight: 800, lineHeight: 1.15 }}>
                                                {hostName}
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                                {organization?.name || 'Workspace'}
                                            </Typography>
                                        </Stack>
                                    </Stack>

                                    <Stack spacing={0.75}>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '1.24rem', fontWeight: 800, lineHeight: 1.12 }}>
                                            {eventType?.title || 'Meeting'}
                                        </Typography>
                                        <Typography sx={subtleTextSx}>
                                            {booking.notes.trim().length > 0
                                                ? booking.notes
                                                : 'Use this guest page to keep the booking current without opening the internal app.'}
                                        </Typography>
                                    </Stack>
                                </Stack>

                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        size="small"
                                        label={statusTone.label}
                                        sx={{
                                            bgcolor: statusTone.bg,
                                            color: statusTone.text,
                                            borderRadius: meetingsRadius.badge,
                                            fontWeight: 700,
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        label={booking.inviteeTimezone}
                                        sx={{
                                            bgcolor: alpha(chatColors.textPrimary, 0.06),
                                            color: chatColors.textSecondary,
                                            borderRadius: meetingsRadius.badge,
                                        }}
                                    />
                                </Stack>

                                <Paper sx={{ ...insetPanelSx, p: 1.5 }}>
                                    <Stack spacing={0.8}>
                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            Booking
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.94rem', fontWeight: 700, lineHeight: 1.45 }}>
                                            {formatDateTime(booking.startsAt)}
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                            {booking.inviteeName} / {booking.inviteeEmail}
                                        </Typography>
                                    </Stack>
                                </Paper>

                                {hostProfile && (
                                    <Button
                                        onClick={() =>
                                            void navigate({
                                                to: '/u/$handle',
                                                params: { handle: hostProfile.handle },
                                            })
                                        }
                                        startIcon={<ArrowBackRoundedIcon />}
                                        sx={[meetingsSecondaryButtonSx, { alignSelf: 'flex-start', ...secondaryButtonOverrideSx }]}
                                    >
                                        Back to booking page
                                    </Button>
                                )}
                            </Stack>
                        </Paper>

                        <Paper sx={{ ...panelSx, p: { xs: 1.2, md: 1.6 } }}>
                            <Stack spacing={1.4}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                                    <Button
                                        onClick={() => setActiveSection('join')}
                                        startIcon={<VideocamRoundedIcon />}
                                        sx={[
                                            activeSection === 'join' ? meetingsPrimaryButtonSx : meetingsSecondaryButtonSx,
                                            secondaryButtonOverrideSx,
                                        ]}
                                    >
                                        Join meeting
                                    </Button>
                                    <Button
                                        onClick={() => setActiveSection('manage')}
                                        startIcon={<EventRepeatRoundedIcon />}
                                        sx={[
                                            activeSection === 'manage' ? meetingsPrimaryButtonSx : meetingsSecondaryButtonSx,
                                            secondaryButtonOverrideSx,
                                        ]}
                                    >
                                        Manage booking
                                    </Button>
                                </Stack>

                                <Paper sx={{ ...insetPanelSx, p: 1.5, minHeight: 520 }}>
                                    {activeSection === 'join' ? (
                                        <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
                                            <Stack spacing={0.35}>
                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                                    Join meeting
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '1.04rem', fontWeight: 700 }}>
                                                    {canJoin ? 'Your meeting is ready' : 'Meeting access is not open yet'}
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.55 }}>
                                                    {joinStatusText}
                                                </Typography>
                                            </Stack>

                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Start time
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {formatDateTime(booking.startsAt)}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                                            Join opens 10 minutes before start
                                                        </Typography>
                                                    </Stack>
                                                </Paper>

                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Guest name
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {booking.inviteeName}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                                            This name will be used on the guest meeting page
                                                        </Typography>
                                                    </Stack>
                                                </Paper>
                                            </Box>

                                            <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                <Stack spacing={0.45}>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                        Before you join
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.6 }}>
                                                        Opening join takes you to the guest meeting page. If the meeting has not opened yet, that page will show the timing and let you in as soon as access is allowed.
                                                    </Typography>
                                                </Stack>
                                            </Paper>

                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                <Button
                                                    onClick={() => void handleJoinMeeting()}
                                                    disabled={isPreparingJoin || !scheduledMeeting || booking.status !== 'confirmed'}
                                                    startIcon={<VideocamRoundedIcon />}
                                                    sx={[meetingsPrimaryButtonSx, primaryButtonOverrideSx]}
                                                >
                                                    {isPreparingJoin ? 'Opening...' : 'Open join page'}
                                                </Button>
                                                <Button
                                                    onClick={() => setActiveSection('manage')}
                                                    sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                                                >
                                                    Manage booking
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    ) : (
                                        <Stack spacing={1.4}>
                                            <Stack spacing={0.35}>
                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                                    Manage booking
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '1.04rem', fontWeight: 700 }}>
                                                    {booking.status === 'cancelled' ? 'This booking has been cancelled' : 'Keep this booking up to date'}
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.55 }}>
                                                    {booking.status === 'cancelled'
                                                        ? 'The booking is no longer active. You can return to the public booking page if you need another time.'
                                                        : 'Change the date and time below or cancel the booking if plans changed.'}
                                                </Typography>
                                            </Stack>

                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Scheduled time
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {formatDateTime(booking.startsAt)}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem', lineHeight: 1.55 }}>
                                                            {booking.inviteeTimezone}
                                                        </Typography>
                                                    </Stack>
                                                </Paper>

                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Guest
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {booking.inviteeName}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                                            {booking.inviteeEmail}
                                                        </Typography>
                                                    </Stack>
                                                </Paper>
                                            </Box>

                                            {booking.notes.trim().length > 0 && (
                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.45}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Notes
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.6 }}>
                                                            {booking.notes}
                                                        </Typography>
                                                    </Stack>
                                                </Paper>
                                            )}

                                            <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />

                                            <Stack spacing={1}>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.84rem', fontWeight: 700 }}>
                                                    Choose a new time
                                                </Typography>
                                                <TextField
                                                    type="datetime-local"
                                                    size="small"
                                                    value={effectiveRescheduleValue}
                                                    onChange={(event) => setRescheduleValue(event.target.value)}
                                                    disabled={booking.status === 'cancelled'}
                                                    sx={meetingsInputSx}
                                                />
                                            </Stack>

                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                <Button
                                                    onClick={() => void handleReschedule()}
                                                    disabled={isProcessing || booking.status === 'cancelled'}
                                                    startIcon={<EventRepeatRoundedIcon />}
                                                    sx={[meetingsPrimaryButtonSx, primaryButtonOverrideSx]}
                                                >
                                                    Reschedule booking
                                                </Button>
                                                <Button
                                                    onClick={() => void handleCancel()}
                                                    disabled={isProcessing || booking.status === 'cancelled'}
                                                    startIcon={<CancelScheduleSendRoundedIcon />}
                                                    sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                                                >
                                                    Cancel booking
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    )}
                                </Paper>
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
