import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import CancelScheduleSendRoundedIcon from '@mui/icons-material/CancelScheduleSendRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { alpha } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useReducer, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { MeetingsSidebar } from './MeetingsSidebar';
import {
    MeetingsPageShell,
    MeetingsPanel,
    meetingsInputSx,
    meetingsPrimaryButtonSx,
    meetingsSecondaryButtonSx,
} from './MeetingsUI';
import { chatColors } from '../../theme/chatColors';
import { tables, reducers } from '../../module_bindings';
import { createPublicDyteMeetingAccess, joinDyteMeetingAccess } from '../../server/dyte';
import { sendMeetingEmail } from '../../server/meetings';
import { setActiveCallSnapshot } from '../../lib/activeCall';
import type {
    ChatChannelMember as DbChatChannelMember,
    ChatScheduledMeeting as DbChatScheduledMeeting,
    MeetingBooking as DbMeetingBooking,
    MeetingEventType as DbMeetingEventType,
    MeetingPublicProfile as DbMeetingPublicProfile,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';

const NONE_U64 = 18446744073709551615n;
const JOIN_LEAD_MS = 10 * 60 * 1000;

function formatBookingTimestamp(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toDateTimeLocalValue(timestampMs: number): string {
    const date = new Date(timestampMs);
    const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    const local = new Date(timestampMs - tzOffsetMs);
    return local.toISOString().slice(0, 16);
}

function formatAccessStatus(booking: DbMeetingBooking, meeting: DbChatScheduledMeeting | null): {
    label: string;
    tone: 'success' | 'warning' | 'default';
    helper: string;
} {
    if (booking.status === 'pending') {
        return {
            label: 'Waiting for approval',
            tone: 'warning',
            helper: 'Guest join access is created after approval.',
        };
    }

    if (booking.status === 'cancelled') {
        return {
            label: 'Cancelled',
            tone: 'default',
            helper: 'Guest join access is no longer active.',
        };
    }

    if (!meeting) {
        return {
            label: 'Preparing room',
            tone: 'warning',
            helper: 'The scheduled room has not been linked yet.',
        };
    }

    if (meeting.status === 'started') {
        return {
            label: 'Join live now',
            tone: 'success',
            helper: 'Guests can join from the public manage page immediately.',
        };
    }

    return {
        label: 'Join opens 10 min before start',
        tone: 'default',
        helper: 'Guests use the public manage page when the meeting opens.',
    };
}

export function MeetingRequestsPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership, membershipUnavailable } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const navigate = useNavigate();

    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allOrganizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [allProfiles] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_public_profile : 'skip');
    const [allEventTypes] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_event_type : 'skip');
    const [allBookings] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_booking : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');

    const approveMeetingBookingReducer = useReducer(reducers.approveMeetingBooking);
    const rejectMeetingBookingReducer = useReducer(reducers.rejectMeetingBooking);
    const cancelMeetingBookingReducer = useReducer(reducers.cancelMeetingBooking);
    const rescheduleMeetingBookingReducer = useReducer(reducers.rescheduleMeetingBooking);
    const joinScheduledMeetingReducer = useReducer(reducers.joinScheduledMeeting);

    const users = (allUsers || []) as DbUser[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const bookings = (allBookings || []) as DbMeetingBooking[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];

    const currentMembership = memberships[0] || null;
    const orgId = currentMembership?.orgId ?? null;
    const currentUser = useMemo(() => {
        if (!currentMembership) return null;
        return users.find((user) => user.id === currentMembership.userId) || null;
    }, [currentMembership, users]);

    const orgName = useMemo(() => {
        if (orgId == null) return 'Workspace';
        return organizations.find((org) => org.id === orgId)?.name || 'Workspace';
    }, [orgId, organizations]);

    const myProfile = useMemo(() => {
        if (!currentUser) return null;
        return profiles.find((profile) => profile.userId === currentUser.id) || null;
    }, [currentUser, profiles]);

    const myEventTypes = useMemo(() => {
        if (!currentUser || orgId == null) return [];
        return eventTypes
            .filter((eventType) => eventType.orgId === orgId && eventType.ownerUserId === currentUser.id)
            .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    }, [currentUser, eventTypes, orgId]);

    const isOrgOwner = currentMembership?.role === 'owner';
    const myChannelIds = useMemo(() => {
        if (!currentUser) return new Set<string>();
        return new Set(
            channelMembers
                .filter((member) => member.userId === currentUser.id)
                .map((member) => String(member.channelId))
        );
    }, [channelMembers, currentUser]);

    const meetingsForUser = useMemo(() => {
        if (orgId == null) return [];
        return scheduledMeetings.filter((meeting) => {
            if (meeting.orgId !== orgId) return false;
            if (meeting.visibility === 'public') return true;
            return myChannelIds.has(String(meeting.channelId));
        });
    }, [myChannelIds, orgId, scheduledMeetings]);

    const upcomingCount = useMemo(
        () => meetingsForUser.filter((meeting) => meeting.status === 'scheduled' && Number(meeting.scheduledAt) >= Date.now()).length,
        [meetingsForUser]
    );
    const liveCount = useMemo(
        () => meetingsForUser.filter((meeting) => meeting.status === 'started').length,
        [meetingsForUser]
    );
    const publicCount = useMemo(
        () => meetingsForUser.filter((meeting) => meeting.visibility === 'public').length,
        [meetingsForUser]
    );

    const pendingBookings = useMemo(() => {
        if (orgId == null || !currentUser) return [];
        return bookings
            .filter((booking) =>
                booking.orgId === orgId &&
                booking.status === 'pending' &&
                (isOrgOwner || booking.hostUserId === currentUser.id)
            )
            .sort((a, b) => Number(a.startsAt) - Number(b.startsAt));
    }, [bookings, currentUser, isOrgOwner, orgId]);

    const confirmedBookings = useMemo(() => {
        if (orgId == null || !currentUser) return [];
        return bookings
            .filter((booking) =>
                booking.orgId === orgId &&
                booking.status === 'confirmed' &&
                (isOrgOwner || booking.hostUserId === currentUser.id)
            )
            .sort((a, b) => Number(a.startsAt) - Number(b.startsAt));
    }, [bookings, currentUser, isOrgOwner, orgId]);

    const publicBookingHref =
        myProfile?.handle
            ? `/u/${myProfile.handle}`
            : null;

    const [approvalActionBookingId, setApprovalActionBookingId] = useState<bigint | null>(null);
    const [bookingActionBookingId, setBookingActionBookingId] = useState<bigint | null>(null);
    const [joiningMeetingId, setJoiningMeetingId] = useState<bigint | null>(null);
    const [reminderBookingId, setReminderBookingId] = useState<bigint | null>(null);
    const [rescheduleValues, setRescheduleValues] = useState<Record<string, string>>({});
    const [openPendingBookingId, setOpenPendingBookingId] = useState<bigint | null>(null);
    const [openConfirmedBookingId, setOpenConfirmedBookingId] = useState<bigint | null>(null);

    const canJoinMeeting = (meeting: DbChatScheduledMeeting): { allowed: boolean; reason: string | null } => {
        if (meeting.status === 'cancelled') return { allowed: false, reason: 'Meeting cancelled' };
        if (meeting.status === 'ended') return { allowed: false, reason: 'Meeting ended' };

        const now = Date.now();
        const scheduledAt = Number(meeting.scheduledAt);
        const joinOpenAt = scheduledAt - JOIN_LEAD_MS;
        if (now < joinOpenAt) {
            const mins = Math.max(1, Math.ceil((joinOpenAt - now) / 60000));
            return { allowed: false, reason: `Join opens in ${mins}m` };
        }

        return { allowed: true, reason: null };
    };

    const handleApproveBooking = async (booking: DbMeetingBooking) => {
        if (!currentUser) return;
        const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
        if (!eventType) {
            toast.error('Event type not found for this booking');
            return;
        }

        setApprovalActionBookingId(booking.id);
        try {
            const meetingSeed = await createPublicDyteMeetingAccess({
                data: {
                    orgName: orgName || 'Workspace',
                    eventTitle: eventType.title,
                    inviteeName: booking.inviteeName,
                },
            } as any);

            if (!meetingSeed.success || !meetingSeed.meetingId) {
                throw new Error(meetingSeed.error || 'Could not create meeting');
            }

            await approveMeetingBookingReducer({
                bookingId: booking.id,
                dyteMeetingId: meetingSeed.meetingId,
            });

            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_confirmed',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: orgName || 'Workspace',
                        eventTitle: eventType.title,
                        startsAt: Number(booking.startsAt),
                        durationMin: Number(eventType.durationMin),
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                    } as any,
                });
                if (!emailResult?.success) {
                    console.warn('Meeting email send failed:', emailResult?.error);
                }
            } catch (emailError) {
                console.warn('Meeting email send threw error:', emailError);
            }
            toast.success('Booking approved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not approve booking');
        } finally {
            setApprovalActionBookingId(null);
        }
    };

    const handleRejectBooking = async (booking: DbMeetingBooking) => {
        const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
        setApprovalActionBookingId(booking.id);
        try {
            await rejectMeetingBookingReducer({ bookingId: booking.id });
            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_rejected',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: orgName || 'Workspace',
                        eventTitle: eventType?.title || 'Meeting',
                        startsAt: Number(booking.startsAt),
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                    } as any,
                });
                if (!emailResult?.success) {
                    console.warn('Meeting email send failed:', emailResult?.error);
                }
            } catch (emailError) {
                console.warn('Meeting email send threw error:', emailError);
            }
            toast.success('Booking declined');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not decline booking');
        } finally {
            setApprovalActionBookingId(null);
        }
    };

    const handleRescheduleBooking = async (booking: DbMeetingBooking) => {
        const value = rescheduleValues[String(booking.id)] || toDateTimeLocalValue(Number(booking.startsAt));
        const timestampMs = new Date(value).getTime();
        if (!Number.isFinite(timestampMs)) {
            toast.error('Select a valid date and time');
            return;
        }

        setBookingActionBookingId(booking.id);
        try {
            const previousStartsAt = Number(booking.startsAt);
            const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
            await rescheduleMeetingBookingReducer({
                bookingId: booking.id,
                startsAt: BigInt(timestampMs),
            });
            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_rescheduled',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: orgName || 'Workspace',
                        eventTitle: eventType?.title || 'Meeting',
                        startsAt: timestampMs,
                        durationMin: Number(eventType?.durationMin || 30n),
                        oldStartsAt: previousStartsAt,
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
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
            setBookingActionBookingId(null);
        }
    };

    const handleCancelBooking = async (booking: DbMeetingBooking) => {
        setBookingActionBookingId(booking.id);
        try {
            const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
            await cancelMeetingBookingReducer({ bookingId: booking.id });
            try {
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: 'booking_cancelled',
                        toEmail: booking.inviteeEmail,
                        toName: booking.inviteeName,
                        orgName: orgName || 'Workspace',
                        eventTitle: eventType?.title || 'Meeting',
                        startsAt: Number(booking.startsAt),
                        timezone: booking.inviteeTimezone,
                        notes: booking.notes,
                        manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
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
            setBookingActionBookingId(null);
        }
    };

    const copyManageLink = async (bookingToken: string) => {
        const manageUrl = `${window.location.origin}/booking/${bookingToken}`;
        try {
            await navigator.clipboard.writeText(manageUrl);
            toast.success('Manage link copied');
        } catch {
            toast.message(manageUrl);
        }
    };

    const handleSendReminder = async (booking: DbMeetingBooking) => {
        const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
        setReminderBookingId(booking.id);
        try {
            const emailResult = await sendMeetingEmail({
                data: {
                    kind: 'reminder_notice',
                    toEmail: booking.inviteeEmail,
                    toName: booking.inviteeName,
                    orgName: orgName || 'Workspace',
                    eventTitle: eventType?.title || 'Meeting',
                    startsAt: Number(booking.startsAt),
                    durationMin: Number(eventType?.durationMin || 30n),
                    timezone: booking.inviteeTimezone,
                    notes: booking.notes,
                    manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                } as any,
            });

            if (!emailResult?.success) {
                throw new Error(emailResult?.error || 'Could not send reminder email');
            }

            toast.success('Reminder email sent');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not send reminder email');
        } finally {
            setReminderBookingId(null);
        }
    };

    const handleJoinMeeting = async (meeting: DbChatScheduledMeeting) => {
        if (!currentUser) return;

        const availability = canJoinMeeting(meeting);
        if (!availability.allowed) {
            toast.message(availability.reason || 'Meeting is not joinable yet.');
            return;
        }

        setJoiningMeetingId(meeting.id);
        try {
            await joinScheduledMeetingReducer({ meetingId: meeting.id });

            const joinResult = await joinDyteMeetingAccess({
                data: {
                    meetingId: meeting.dyteMeetingId,
                    channelId:
                        meeting.channelId === NONE_U64
                            ? `public-${String(meeting.orgId)}`
                            : String(meeting.channelId),
                    participantName: currentUser.name || currentUser.email || 'Participant',
                } as any,
            });

            if (!joinResult.success || !joinResult.authToken) {
                toast.error(joinResult.error || 'Could not open the meeting');
                return;
            }

            const callSessionId =
                meeting.startedCallSessionId !== NONE_U64 ? String(meeting.startedCallSessionId) : null;

            setActiveCallSnapshot({
                open: true,
                authToken: joinResult.authToken,
                title: meeting.title,
                channelId: meeting.channelId === NONE_U64 ? null : String(meeting.channelId),
                meetingId: meeting.dyteMeetingId,
                callSessionId,
            });

            toast.success('Meeting opened');
            void navigate({ to: '/chat' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not open the meeting');
        } finally {
            setJoiningMeetingId(null);
        }
    };

    if (isLoading || isCheckingMembership) {
        return (
            <DashboardLayout orgName={orgName}>
                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                    <CircularProgress sx={{ color: '#ffffff' }} />
                </Box>
            </DashboardLayout>
        );
    }

    if (!isAuthenticated) {
        void navigate({ to: '/login' });
        return null;
    }

    if (membershipUnavailable) {
        return (
            <DashboardLayout orgName={orgName}>
                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', p: 3 }}>
                    <Stack spacing={1.2} alignItems="center" sx={{ maxWidth: 420 }}>
                        <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.98rem' }}>
                            Workspace connection is still syncing
                        </Typography>
                        <Typography sx={{ color: '#8f98a8', fontSize: '0.8rem', textAlign: 'center' }}>
                            This page depends on the live workspace identity. Refresh after the SpacetimeDB session reconnects.
                        </Typography>
                        <Button onClick={() => window.location.reload()} sx={meetingsPrimaryButtonSx}>
                            Refresh
                        </Button>
                    </Stack>
                </Box>
            </DashboardLayout>
        );
    }

    if (!hasOrganization || orgId == null) {
        void navigate({ to: '/onboarding' });
        return null;
    }

    if (!currentUser) {
        return (
            <DashboardLayout orgName={orgName}>
                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                    <CircularProgress sx={{ color: '#ffffff' }} />
                </Box>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            orgName={orgName}
            chatSidebar={
                <MeetingsSidebar
                    upcomingCount={upcomingCount}
                    liveCount={liveCount}
                    publicCount={publicCount}
                />
            }
        >
            <MeetingsPageShell
                icon={<ChecklistRoundedIcon sx={{ fontSize: 20 }} />}
                title="Booking Requests"
                description="Approve new requests, reschedule confirmed bookings, and share guest manage links from one place."
                actions={
                    publicBookingHref ? (
                        <Button
                            size="small"
                            component="a"
                            href={publicBookingHref}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                            sx={meetingsSecondaryButtonSx}
                        >
                            Open Booking Page
                        </Button>
                    ) : null
                }
                stats={[
                    { label: 'Pending', value: pendingBookings.length, helper: 'Requests waiting for approval' },
                    { label: 'Confirmed', value: confirmedBookings.length, helper: 'Approved bookings you can manage' },
                ]}
            >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '0.88fr 1.12fr' }, gap: 1.2 }}>
                    <MeetingsPanel
                        title="Waiting for your approval"
                        description="Open each request, review the guest details, then approve or decline from the workflow panel."
                    >
                        <Stack spacing={0.85}>
                            {pendingBookings.length === 0 ? (
                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                    No booking requests are waiting right now.
                                </Typography>
                            ) : (
                                pendingBookings.map((booking) => {
                                    const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
                                    const processing = approvalActionBookingId === booking.id;
                                    const expanded = openPendingBookingId === booking.id;
                                    const initial = booking.inviteeName.trim().charAt(0).toUpperCase() || 'G';
                                    return (
                                        <Box
                                            key={String(booking.id)}
                                            sx={{
                                                p: 1.15,
                                                borderRadius: 1.6,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.02),
                                            }}
                                        >
                                            <Stack spacing={1}>
                                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                                        <Avatar
                                                            variant="rounded"
                                                            sx={{
                                                                width: 40,
                                                                height: 40,
                                                                bgcolor: alpha(chatColors.textPrimary, 0.08),
                                                                color: chatColors.textPrimary,
                                                                fontWeight: 800,
                                                                borderRadius: 1.2,
                                                            }}
                                                        >
                                                            {initial}
                                                        </Avatar>
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 700 }}>
                                                                {booking.inviteeName} • {eventType?.title || 'Meeting'}
                                                            </Typography>
                                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.72rem' }}>
                                                                {formatBookingTimestamp(booking.startsAt)}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                    <Button
                                                        onClick={() =>
                                                            setOpenPendingBookingId((current) => (current === booking.id ? null : booking.id))
                                                        }
                                                        endIcon={expanded ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />}
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        {expanded ? 'Hide review' : 'Review request'}
                                                    </Button>
                                                </Stack>

                                                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                                    <Chip
                                                        size="small"
                                                        label="Approval required"
                                                        sx={{
                                                            bgcolor: alpha(chatColors.warning, 0.14),
                                                            color: '#ffd59a',
                                                            borderRadius: 1,
                                                            fontWeight: 700,
                                                        }}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        label={booking.inviteeEmail}
                                                        sx={{
                                                            bgcolor: alpha(chatColors.textPrimary, 0.05),
                                                            color: chatColors.textSecondary,
                                                            borderRadius: 1,
                                                        }}
                                                    />
                                                </Stack>

                                                {expanded ? (
                                                    <Stack spacing={1}>
                                                        <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />

                                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 0.95 }}>
                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Guest
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    {booking.inviteeName}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.73rem', lineHeight: 1.5 }}>
                                                                    {booking.inviteeEmail}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', mt: 0.35 }}>
                                                                    {booking.inviteeTimezone}
                                                                </Typography>
                                                            </Box>

                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Request
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    {eventType?.title || 'Meeting'}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.73rem', lineHeight: 1.5 }}>
                                                                    Requested for {formatBookingTimestamp(booking.startsAt)}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', mt: 0.35 }}>
                                                                    {eventType ? `${eventType.durationMin.toString()} min` : 'Meeting'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>

                                                        {booking.notes.trim().length > 0 ? (
                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Notes from guest
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.6 }}>
                                                                    {booking.notes}
                                                                </Typography>
                                                            </Box>
                                                        ) : null}

                                                        <Box
                                                            sx={{
                                                                p: 1,
                                                                borderRadius: 1.2,
                                                                bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                            }}
                                                        >
                                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                Approval flow
                                                            </Typography>
                                                            <Typography sx={{ mt: 0.45, color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.6 }}>
                                                                Approving this request creates the guest meeting room and sends the public manage link. Declining it sends the guest back to the booking flow instead.
                                                            </Typography>
                                                        </Box>

                                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                                                            <Button
                                                                onClick={() => void handleApproveBooking(booking)}
                                                                disabled={processing}
                                                                startIcon={<DoneRoundedIcon sx={{ fontSize: 14 }} />}
                                                                sx={meetingsPrimaryButtonSx}
                                                            >
                                                                Approve and send guest link
                                                            </Button>
                                                            <Button
                                                                onClick={() => void handleRejectBooking(booking)}
                                                                disabled={processing}
                                                                startIcon={<CloseRoundedIcon sx={{ fontSize: 14 }} />}
                                                                sx={meetingsSecondaryButtonSx}
                                                            >
                                                                Decline request
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                ) : null}
                                            </Stack>
                                        </Box>
                                    );
                                })
                            )}
                        </Stack>
                    </MeetingsPanel>

                    <MeetingsPanel
                        title="Approved meetings"
                        description="Open each booking to review guest access, join readiness, manage links, and booking changes."
                    >
                        <Stack spacing={0.85}>
                            {confirmedBookings.length === 0 ? (
                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                    No confirmed bookings yet.
                                </Typography>
                            ) : (
                                confirmedBookings.map((booking) => {
                                    const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
                                    const scheduledMeeting =
                                        booking.scheduledMeetingId !== NONE_U64
                                            ? scheduledMeetings.find((meeting) => meeting.id === booking.scheduledMeetingId) || null
                                            : null;
                                    const accessStatus = formatAccessStatus(booking, scheduledMeeting);
                                    const processing = bookingActionBookingId === booking.id;
                                    const joinAvailability = scheduledMeeting ? canJoinMeeting(scheduledMeeting) : null;
                                    const joining = joiningMeetingId === booking.id;
                                    const sendingReminder = reminderBookingId === booking.id;
                                    const expanded = openConfirmedBookingId === booking.id;
                                    const inputValue =
                                        rescheduleValues[String(booking.id)] ||
                                        toDateTimeLocalValue(Number(booking.startsAt));
                                    const initial = booking.inviteeName.trim().charAt(0).toUpperCase() || 'G';
                                    return (
                                        <Box
                                            key={String(booking.id)}
                                            sx={{
                                                p: 1.15,
                                                borderRadius: 1.6,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.02),
                                            }}
                                        >
                                            <Stack spacing={1}>
                                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                                        <Avatar
                                                            variant="rounded"
                                                            sx={{
                                                                width: 40,
                                                                height: 40,
                                                                bgcolor: alpha(chatColors.textPrimary, 0.08),
                                                                color: chatColors.textPrimary,
                                                                fontWeight: 800,
                                                                borderRadius: 1.2,
                                                            }}
                                                        >
                                                            {initial}
                                                        </Avatar>
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 700 }}>
                                                                {booking.inviteeName} • {eventType?.title || 'Meeting'}
                                                            </Typography>
                                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.72rem' }}>
                                                                {formatBookingTimestamp(booking.startsAt)}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                    <Button
                                                        onClick={() =>
                                                            setOpenConfirmedBookingId((current) => (current === booking.id ? null : booking.id))
                                                        }
                                                        endIcon={expanded ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />}
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        {expanded ? 'Hide flow' : 'Open flow'}
                                                    </Button>
                                                </Stack>

                                                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                                    <Chip
                                                        size="small"
                                                        label={accessStatus.label}
                                                        sx={{
                                                            bgcolor:
                                                                accessStatus.tone === 'success'
                                                                    ? alpha(chatColors.success, 0.14)
                                                                    : accessStatus.tone === 'warning'
                                                                        ? alpha(chatColors.warning, 0.16)
                                                                        : alpha(chatColors.textPrimary, 0.05),
                                                            color:
                                                                accessStatus.tone === 'success'
                                                                    ? '#b7f3cf'
                                                                    : accessStatus.tone === 'warning'
                                                                        ? '#ffd59a'
                                                                        : chatColors.textSecondary,
                                                            borderRadius: 1,
                                                            fontWeight: 700,
                                                        }}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        label={booking.inviteeEmail}
                                                        sx={{
                                                            bgcolor: alpha(chatColors.textPrimary, 0.05),
                                                            color: chatColors.textSecondary,
                                                            borderRadius: 1,
                                                        }}
                                                    />
                                                </Stack>

                                                {expanded ? (
                                                    <Stack spacing={1}>
                                                        <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />

                                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 0.95 }}>
                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Guest
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    {booking.inviteeName}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.73rem', lineHeight: 1.5 }}>
                                                                    {booking.inviteeEmail}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', mt: 0.35 }}>
                                                                    {booking.inviteeTimezone}
                                                                </Typography>
                                                            </Box>

                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Guest access
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    {accessStatus.label}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.73rem', lineHeight: 1.5 }}>
                                                                    {accessStatus.helper}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', mt: 0.35 }}>
                                                                    {scheduledMeeting ? `Room: ${scheduledMeeting.title}` : 'Room will appear after setup'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>

                                                        <Box
                                                            sx={{
                                                                p: 1,
                                                                borderRadius: 1.2,
                                                                bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                            }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Meeting access
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.6 }}>
                                                                    Open the meeting as host, then use the guest page to check the outside participant journey and later booking changes.
                                                                </Typography>
                                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ mt: 0.85 }}>
                                                                    <Button
                                                                        onClick={() => scheduledMeeting && void handleJoinMeeting(scheduledMeeting)}
                                                                        disabled={!scheduledMeeting || !joinAvailability?.allowed || joining}
                                                                        startIcon={<VideocamRoundedIcon sx={{ fontSize: 13 }} />}
                                                                        sx={meetingsPrimaryButtonSx}
                                                                    >
                                                                        {joining ? 'Opening meeting...' : 'Start / join meeting'}
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => void handleSendReminder(booking)}
                                                                        disabled={sendingReminder}
                                                                        startIcon={<NotificationsActiveRoundedIcon sx={{ fontSize: 13 }} />}
                                                                        sx={meetingsSecondaryButtonSx}
                                                                    >
                                                                        {sendingReminder ? 'Sending reminder...' : 'Send reminder email'}
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => void copyManageLink(booking.bookingToken)}
                                                                        startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 13 }} />}
                                                                        sx={meetingsSecondaryButtonSx}
                                                                    >
                                                                        Copy manage link
                                                                    </Button>
                                                                <Button
                                                                    component="a"
                                                                    href={`/booking/${booking.bookingToken}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
                                                                    sx={meetingsSecondaryButtonSx}
                                                                >
                                                                    Open guest page
                                                                </Button>
                                                                </Stack>
                                                                {scheduledMeeting && !joinAvailability?.allowed ? (
                                                                    <Typography sx={{ mt: 0.7, color: chatColors.textMuted, fontSize: '0.72rem' }}>
                                                                        {joinAvailability?.reason}
                                                                    </Typography>
                                                                ) : null}
                                                            </Box>

                                                        {booking.notes.trim().length > 0 ? (
                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1.2,
                                                                    bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                }}
                                                            >
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                                    Notes from guest
                                                                </Typography>
                                                                <Typography sx={{ mt: 0.45, color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.6 }}>
                                                                    {booking.notes}
                                                                </Typography>
                                                            </Box>
                                                        ) : null}

                                                        <TextField
                                                            type="datetime-local"
                                                            size="small"
                                                            label="Move this booking to"
                                                            value={inputValue}
                                                            onChange={(event) =>
                                                                setRescheduleValues((prev) => ({
                                                                    ...prev,
                                                                    [String(booking.id)]: event.target.value,
                                                                }))
                                                            }
                                                            sx={meetingsInputSx}
                                                        />

                                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                                                            <Button
                                                                onClick={() => void handleRescheduleBooking(booking)}
                                                                disabled={processing}
                                                                startIcon={<EventRepeatRoundedIcon sx={{ fontSize: 14 }} />}
                                                                sx={meetingsPrimaryButtonSx}
                                                            >
                                                                Save new time
                                                            </Button>
                                                            <Button
                                                                onClick={() => void handleCancelBooking(booking)}
                                                                disabled={processing}
                                                                startIcon={<CancelScheduleSendRoundedIcon sx={{ fontSize: 14 }} />}
                                                                sx={meetingsSecondaryButtonSx}
                                                            >
                                                                Cancel booking
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                ) : null}
                                            </Stack>
                                        </Box>
                                    );
                                })
                            )}
                        </Stack>
                    </MeetingsPanel>
                </Box>
            </MeetingsPageShell>
        </DashboardLayout>
    );
}
