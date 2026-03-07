import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { alpha } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { MeetingsSidebar } from './MeetingsSidebar';
import { MeetingsPageShell, MeetingsPanel, meetingsPrimaryButtonSx, meetingsSecondaryButtonSx } from './MeetingsUI';
import { chatColors } from '../../theme/chatColors';
import { tables } from '../../module_bindings';
import { sendMeetingEmail } from '../../server/meetings';
import type {
    ChatChannelMember as DbChatChannelMember,
    ChatScheduledMeeting as DbChatScheduledMeeting,
    MeetingActivity as DbMeetingActivity,
    MeetingBooking as DbMeetingBooking,
    MeetingEventType as DbMeetingEventType,
    MeetingFollowupTemplate as DbMeetingFollowupTemplate,
    MeetingPublicProfile as DbMeetingPublicProfile,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';

const NONE_U64 = 18446744073709551615n;

function formatBookingTimestamp(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatActivityTimestamp(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function parseTemplateItems(itemsJson: string): string[] {
    try {
        const parsed = JSON.parse(itemsJson) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
        return [];
    }
}

export function MeetingActivityPage() {
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
    const [allMeetingActivity] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_activity : 'skip');
    const [allFollowupTemplates] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_followup_template : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');

    const users = (allUsers || []) as DbUser[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const bookings = (allBookings || []) as DbMeetingBooking[];
    const meetingActivity = (allMeetingActivity || []) as DbMeetingActivity[];
    const followupTemplates = (allFollowupTemplates || []) as DbMeetingFollowupTemplate[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];

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

    const orgActivityFeed = useMemo(() => {
        if (orgId == null) return [];
        return meetingActivity
            .filter((row) => row.orgId === orgId)
            .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
            .slice(0, 40);
    }, [meetingActivity, orgId]);

    const defaultFollowupTemplate = useMemo(() => {
        if (orgId == null) return null;
        const orgTemplates = followupTemplates
            .filter((template) => template.orgId === orgId)
            .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
        return orgTemplates.find((template) => template.isDefault) || orgTemplates[0] || null;
    }, [followupTemplates, orgId]);

    const endedBookings = useMemo(() => {
        if (orgId == null || !currentUser) return [];
        const endedMeetingIds = new Set(
            scheduledMeetings
                .filter((meeting) => meeting.orgId === orgId && meeting.status === 'ended')
                .map((meeting) => String(meeting.id))
        );

        return bookings
            .filter((booking) =>
                booking.orgId === orgId &&
                booking.status === 'confirmed' &&
                booking.scheduledMeetingId !== NONE_U64 &&
                endedMeetingIds.has(String(booking.scheduledMeetingId)) &&
                (isOrgOwner || booking.hostUserId === currentUser.id)
            )
            .sort((a, b) => Number(b.startsAt) - Number(a.startsAt))
            .slice(0, 12);
    }, [bookings, currentUser, isOrgOwner, orgId, scheduledMeetings]);

    const publicBookingHref =
        myProfile?.handle
            ? `/u/${myProfile.handle}`
            : null;

    const [nudgeBookingId, setNudgeBookingId] = useState<bigint | null>(null);

    const handleSendFollowupNudge = async (booking: DbMeetingBooking) => {
        const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
        const template = defaultFollowupTemplate;

        let checklistText = '';
        if (template) {
            const clean = parseTemplateItems(template.itemsJson);
            if (clean.length > 0) {
                checklistText = `Follow-up checklist:\n- ${clean.join('\n- ')}`;
            }
        }

        setNudgeBookingId(booking.id);
        try {
            const emailResult = await sendMeetingEmail({
                data: {
                    kind: 'followup_nudge',
                    toEmail: booking.inviteeEmail,
                    toName: booking.inviteeName,
                    orgName: orgName || 'Workspace',
                    eventTitle: eventType?.title || 'Meeting',
                    startsAt: Number(booking.startsAt),
                    durationMin: Number(eventType?.durationMin || 30n),
                    timezone: booking.inviteeTimezone,
                    notes: checklistText || booking.notes,
                    manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
                } as any,
            });
            if (!emailResult?.success) {
                throw new Error(emailResult?.error || 'Could not send follow-up nudge');
            }
            toast.success('Follow-up nudge sent');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not send follow-up nudge');
        } finally {
            setNudgeBookingId(null);
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
                icon={<TimelineRoundedIcon sx={{ fontSize: 20 }} />}
                title="Activity & Follow-up"
                description="Track booking changes and send a clean follow-up to guests after meetings end."
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
                    { label: 'Activity items', value: orgActivityFeed.length, helper: 'Recent booking lifecycle updates' },
                    { label: 'Ended meetings', value: endedBookings.length, helper: 'Meetings ready for follow-up' },
                ]}
            >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.05fr 0.95fr' }, gap: 1.2 }}>
                    <MeetingsPanel
                        title="Recent booking activity"
                        description="This feed updates as bookings are created, approved, rescheduled, and cancelled."
                    >
                        <Stack spacing={0.7} sx={{ maxHeight: 420, overflow: 'auto', pr: 0.4 }}>
                            {orgActivityFeed.length === 0 ? (
                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                    Activity will appear here as bookings move through their lifecycle.
                                </Typography>
                            ) : (
                                orgActivityFeed.map((entry) => (
                                    <Box
                                        key={String(entry.id)}
                                        sx={{
                                            p: 0.95,
                                            borderRadius: 1.4,
                                            border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                            bgcolor: alpha(chatColors.textPrimary, 0.02),
                                        }}
                                    >
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.72rem', fontWeight: 700 }}>
                                            {entry.description}
                                        </Typography>
                                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                                            <Chip
                                                size="small"
                                                label={entry.eventType}
                                                sx={{ bgcolor: alpha(chatColors.textPrimary, 0.08), color: chatColors.textSecondary }}
                                            />
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.68rem' }}>
                                                {formatActivityTimestamp(entry.createdAt)}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                ))
                            )}
                        </Stack>
                    </MeetingsPanel>

                    <MeetingsPanel
                        title="Ended meetings"
                        description="Send a follow-up nudge with the default checklist after the meeting wraps."
                    >
                        <Stack spacing={0.8}>
                            {defaultFollowupTemplate ? (
                                <Box
                                    sx={{
                                        p: 0.95,
                                        borderRadius: 1.4,
                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                        bgcolor: alpha(chatColors.textPrimary, 0.02),
                                    }}
                                >
                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.74rem', fontWeight: 700 }}>
                                        Default follow-up checklist
                                    </Typography>
                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.68rem', mb: 0.6 }}>
                                        {defaultFollowupTemplate.title}
                                    </Typography>
                                    <Stack spacing={0.3}>
                                        {parseTemplateItems(defaultFollowupTemplate.itemsJson).slice(0, 4).map((item, index) => (
                                            <Typography
                                                key={`${String(defaultFollowupTemplate.id)}-${index}`}
                                                sx={{ color: chatColors.textMuted, fontSize: '0.7rem', lineHeight: 1.45 }}
                                            >
                                                {index + 1}. {item}
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                            ) : (
                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                    Set a default follow-up template in Settings first.
                                </Typography>
                            )}

                            {endedBookings.length === 0 ? (
                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                    Ended meetings will appear here when a follow-up email can be sent.
                                </Typography>
                            ) : (
                                endedBookings.map((booking) => {
                                    const eventType = eventTypes.find((row) => row.id === booking.eventTypeId);
                                    const sending = nudgeBookingId === booking.id;
                                    return (
                                        <Box
                                            key={String(booking.id)}
                                            sx={{
                                                p: 0.95,
                                                borderRadius: 1.4,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.02),
                                            }}
                                        >
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.8}>
                                                <Box>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.72rem', fontWeight: 700 }}>
                                                        {booking.inviteeName} • {eventType?.title || 'Meeting'}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.68rem' }}>
                                                        Ended • {formatBookingTimestamp(booking.startsAt)}
                                                    </Typography>
                                                </Box>
                                                <Button
                                                    size="small"
                                                    disabled={sending || !defaultFollowupTemplate}
                                                    onClick={() => void handleSendFollowupNudge(booking)}
                                                    sx={meetingsPrimaryButtonSx}
                                                >
                                                    {sending ? 'Sending...' : 'Send follow-up'}
                                                </Button>
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
