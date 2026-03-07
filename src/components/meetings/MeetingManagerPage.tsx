import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import CancelScheduleSendRoundedIcon from '@mui/icons-material/CancelScheduleSendRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { tables, reducers } from '../../module_bindings';
import type {
    ChatCallSession as DbChatCallSession,
    ChatChannel as DbChatChannel,
    ChatChannelMember as DbChatChannelMember,
    ChatScheduledMeeting as DbChatScheduledMeeting,
    MeetingEventType as DbMeetingEventType,
    MeetingPublicProfile as DbMeetingPublicProfile,
    OrganizationMember as DbOrganizationMember,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';
import { createDyteMeetingAccess, createPublicMeetingInviteLink, joinDyteMeetingAccess } from '../../server/dyte';
import { sendMeetingEmail } from '../../server/meetings';
import { setActiveCallSnapshot } from '../../lib/activeCall';
import { appRadii } from '../../theme/radii';
import { MeetingsSidebar } from './MeetingsSidebar';
import {
    MeetingsPageShell,
    MeetingsPanel,
    meetingsInputSx,
    meetingsPrimaryButtonSx,
    meetingsSecondaryButtonSx,
} from './MeetingsUI';

const NONE_U64 = 18446744073709551615n;
const JOIN_LEAD_MS = 10 * 60 * 1000;

type MeetingVisibility = 'channel' | 'public';

function formatDateTime(timestamp: bigint): string {
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

function statusColor(status: string): { bg: string; color: string; label: string } {
    if (status === 'scheduled') return { bg: 'rgba(120,160,255,0.16)', color: '#b8ceff', label: 'Scheduled' };
    if (status === 'started') return { bg: 'rgba(56,200,114,0.16)', color: '#9cf0bf', label: 'Live' };
    if (status === 'ended') return { bg: 'rgba(255,255,255,0.09)', color: '#c2c8d6', label: 'Ended' };
    if (status === 'cancelled') return { bg: 'rgba(227,61,79,0.15)', color: '#f2a9b3', label: 'Cancelled' };
    return { bg: 'rgba(255,255,255,0.09)', color: '#c2c8d6', label: status };
}

export function MeetingManagerPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership, membershipUnavailable } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const navigate = useNavigate();
    const location = useLocation();

    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allOrganizationMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');
    const [allCallSessions] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_call_session : 'skip');
    const [allOrganizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [allProfiles] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_public_profile : 'skip');
    const [allEventTypes] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_event_type : 'skip');

    const createScheduledMeetingReducer = useReducer(reducers.createScheduledMeeting);
    const cancelScheduledMeetingReducer = useReducer(reducers.cancelScheduledMeeting);
    const joinScheduledMeetingReducer = useReducer(reducers.joinScheduledMeeting);

    const users = (allUsers || []) as DbUser[];
    const channels = (allChannels || []) as DbChatChannel[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const organizationMembers = (allOrganizationMembers || []) as DbOrganizationMember[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];
    const callSessions = (allCallSessions || []) as DbChatCallSession[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];

    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [meetingVisibility, setMeetingVisibility] = useState<MeetingVisibility>(() =>
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('type') === 'public'
            ? 'public'
            : 'channel'
    );
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDescription, setMeetingDescription] = useState('');
    const [scheduledFor, setScheduledFor] = useState(() => toDateTimeLocalValue(Date.now() + 30 * 60 * 1000));
    const [isCreating, setIsCreating] = useState(false);
    const [joiningMeetingId, setJoiningMeetingId] = useState<string | null>(null);
    const [cancellingMeetingId, setCancellingMeetingId] = useState<string | null>(null);
    const [sharingMeetingId, setSharingMeetingId] = useState<string | null>(null);

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

    const myChannelIds = useMemo(() => {
        if (!currentUser) return new Set<string>();
        return new Set(
            channelMembers
                .filter((member) => member.userId === currentUser.id)
                .map((member) => String(member.channelId))
        );
    }, [channelMembers, currentUser]);

    const myChannels = useMemo(() => {
        if (orgId == null) return [];
        return channels
            .filter((channel) => channel.orgId === orgId && myChannelIds.has(String(channel.id)))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [channels, myChannelIds, orgId]);

    const selectedChannel = myChannels.find((channel) => String(channel.id) === selectedChannelId) || null;

    const meetingsForUser = useMemo(() => {
        if (orgId == null) return [];
        const rows = scheduledMeetings.filter((meeting) => {
            if (meeting.orgId !== orgId) return false;
            if (meeting.visibility === 'public') return true;
            return myChannelIds.has(String(meeting.channelId));
        });

        return rows.sort((a, b) => {
            const aTime = Number(a.scheduledAt);
            const bTime = Number(b.scheduledAt);
            const aFuture = aTime >= Date.now();
            const bFuture = bTime >= Date.now();
            if (aFuture !== bFuture) return aFuture ? -1 : 1;
            return aFuture ? aTime - bTime : bTime - aTime;
        });
    }, [myChannelIds, orgId, scheduledMeetings]);

    const activeCallByMeetingId = useMemo(() => {
        const map = new Map<string, DbChatCallSession>();
        for (const session of callSessions) {
            if (session.status !== 'active' || session.endedAt !== NONE_U64) continue;
            map.set(session.dyteMeetingId, session);
        }
        return map;
    }, [callSessions]);

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
    const activeBookingEventTypeCount = useMemo(
        () => myEventTypes.filter((eventType) => eventType.isActive).length,
        [myEventTypes]
    );
    const approvalEventTypeCount = useMemo(
        () => myEventTypes.filter((eventType) => eventType.requireApproval).length,
        [myEventTypes]
    );

    useEffect(() => {
        const searchType = typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('type')
            : null;
        const nextVisibility = searchType === 'public' ? 'public' : 'channel';
        if (nextVisibility !== meetingVisibility) {
            setMeetingVisibility(nextVisibility);
        }
    }, [location.href]); // Keep manager selection in sync when sidebar links route here.

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('type', meetingVisibility);
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }, [meetingVisibility]);
    const actionQueueMeetings = useMemo(() => {
        const now = Date.now();
        return meetingsForUser
            .filter((meeting) => {
                const scheduledAt = Number(meeting.scheduledAt);
                if (meeting.status === 'started') return true;
                if (meeting.status !== 'scheduled') return false;
                return scheduledAt >= now && scheduledAt <= now + 6 * 60 * 60 * 1000;
            })
            .sort((a, b) => {
                if (a.status === 'started' && b.status !== 'started') return -1;
                if (a.status !== 'started' && b.status === 'started') return 1;
                return Number(a.scheduledAt) - Number(b.scheduledAt);
            })
            .slice(0, 5);
    }, [meetingsForUser]);

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

    const handleScheduleMeeting = async () => {
        if (!currentUser || orgId == null) return;
        const title = meetingTitle.trim();
        if (!title) {
            toast.error('Meeting name is required.');
            return;
        }

        if (meetingVisibility === 'channel' && !selectedChannel) {
            toast.error('Choose a channel for channel-specific meetings.');
            return;
        }

        const scheduledAtMs = new Date(scheduledFor).getTime();
        if (!Number.isFinite(scheduledAtMs)) {
            toast.error('Please choose a valid schedule date and time.');
            return;
        }

        if (scheduledAtMs <= Date.now() + 60_000) {
            toast.error('Schedule the meeting at least 1 minute in the future.');
            return;
        }

        setIsCreating(true);
        try {
            const dyteChannelId =
                meetingVisibility === 'channel' && selectedChannel
                    ? String(selectedChannel.id)
                    : `public-${String(orgId)}`;
            const dyteChannelName =
                meetingVisibility === 'channel' && selectedChannel
                    ? selectedChannel.name
                    : 'External Guest Meeting';

            const createResult = await createDyteMeetingAccess({
                data: {
                    channelId: dyteChannelId,
                    channelName: dyteChannelName,
                    participantName: currentUser.name || currentUser.email || 'Participant',
                    orgName,
                } as any,
            });

            if (!createResult.success || !createResult.meetingId) {
                toast.error(createResult.error || 'Unable to provision meeting room.');
                return;
            }

            await createScheduledMeetingReducer({
                orgId,
                channelId:
                    meetingVisibility === 'channel' && selectedChannel
                        ? selectedChannel.id
                        : NONE_U64,
                visibility: meetingVisibility,
                title,
                description: meetingDescription.trim(),
                scheduledAt: BigInt(scheduledAtMs),
                dyteMeetingId: createResult.meetingId,
            });

            const recipientIds = new Set<string>();
            if (meetingVisibility === 'channel' && selectedChannel) {
                for (const member of channelMembers) {
                    if (member.channelId === selectedChannel.id && member.userId !== currentUser.id) {
                        recipientIds.add(String(member.userId));
                    }
                }
            } else {
                for (const member of organizationMembers) {
                    if (member.orgId === orgId && member.userId !== currentUser.id) {
                        recipientIds.add(String(member.userId));
                    }
                }
            }

            const recipients = users.filter((user) => recipientIds.has(String(user.id)) && user.email.includes('@'));
            if (recipients.length > 0) {
                await Promise.allSettled(
                    recipients.map((recipient) =>
                        sendMeetingEmail({
                            data: {
                                kind: 'scheduled_notice',
                                toEmail: recipient.email,
                                toName: recipient.name || recipient.email.split('@')[0],
                                orgName,
                                eventTitle: title,
                                startsAt: scheduledAtMs,
                                durationMin: 30,
                                joinContext: meetingVisibility === 'channel' && selectedChannel ? `#${selectedChannel.name}` : 'Guest invite link',
                            } as any,
                        })
                    )
                );
            }

            toast.success('Meeting scheduled successfully.');
            setMeetingTitle('');
            setMeetingDescription('');
            setScheduledFor(toDateTimeLocalValue(Date.now() + 30 * 60 * 1000));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not schedule meeting');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinMeeting = async (meeting: DbChatScheduledMeeting) => {
        if (!currentUser) return;

        const availability = canJoinMeeting(meeting);
        if (!availability.allowed) {
            toast.message(availability.reason || 'Meeting is not joinable yet.');
            return;
        }

        setJoiningMeetingId(String(meeting.id));
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
                toast.error(joinResult.error || 'Could not join the meeting');
                return;
            }

            const activeCall = activeCallByMeetingId.get(meeting.dyteMeetingId) || null;
            const callSessionId =
                activeCall?.id ||
                (meeting.startedCallSessionId !== NONE_U64 ? meeting.startedCallSessionId : null);

            setActiveCallSnapshot({
                open: true,
                authToken: joinResult.authToken,
                title: meeting.title,
                channelId: meeting.channelId === NONE_U64 ? null : String(meeting.channelId),
                meetingId: meeting.dyteMeetingId,
                callSessionId: callSessionId == null ? null : String(callSessionId),
            });

            toast.success('Meeting opened. Redirecting to chat...');
            void navigate({ to: '/chat' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not join the meeting');
        } finally {
            setJoiningMeetingId(null);
        }
    };

    const handleCancelMeeting = async (meeting: DbChatScheduledMeeting) => {
        setCancellingMeetingId(String(meeting.id));
        try {
            await cancelScheduledMeetingReducer({ meetingId: meeting.id });
            toast.success('Meeting cancelled.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not cancel meeting');
        } finally {
            setCancellingMeetingId(null);
        }
    };

    const handleCopyGuestInvite = async (meeting: DbChatScheduledMeeting) => {
        if (meeting.visibility !== 'public') return;

        setSharingMeetingId(String(meeting.id));
        try {
            const result = await createPublicMeetingInviteLink({
                data: {
                    meetingId: meeting.dyteMeetingId,
                    orgId: String(meeting.orgId),
                    title: meeting.title,
                    scheduledAt: Number(meeting.scheduledAt),
                } as any,
            });

            if (!result.success || !result.inviteUrl) {
                toast.error(result.error || 'Could not create guest link');
                return;
            }

            await navigator.clipboard.writeText(result.inviteUrl);
            toast.success('Guest meeting link copied');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not copy guest link');
        } finally {
            setSharingMeetingId(null);
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
                            The meetings workspace needs a live SpacetimeDB session on direct load. Refresh after reconnect instead of being redirected.
                        </Typography>
                        <Button
                            onClick={() => window.location.reload()}
                            sx={meetingsPrimaryButtonSx}
                        >
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

    const publicBookingHref =
        myProfile?.handle ? `/u/${myProfile.handle}` : null;

    const renderMeetingActions = (meeting: DbChatScheduledMeeting) => {
        const availability = canJoinMeeting(meeting);
        const isJoinLoading = joiningMeetingId === String(meeting.id);
        const canCancel =
            meeting.status === 'scheduled' &&
            meeting.createdByUserId === currentUser?.id;
        const isCancelLoading = cancellingMeetingId === String(meeting.id);
        const isShareLoading = sharingMeetingId === String(meeting.id);

        return (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                {meeting.visibility === 'public' && (
                    <Button
                        size="small"
                        onClick={() => void handleCopyGuestInvite(meeting)}
                        disabled={isShareLoading}
                        startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            textTransform: 'none',
                            minWidth: 0,
                            color: '#d7e1ff',
                            border: '1px solid rgba(114,138,255,0.28)',
                            bgcolor: 'rgba(114,138,255,0.1)',
                            borderRadius: appRadii.control,
                            px: 1,
                            '&:hover': { bgcolor: 'rgba(114,138,255,0.16)' },
                        }}
                    >
                        {isShareLoading ? 'Copying...' : 'Guest link'}
                    </Button>
                )}
                {canCancel && (
                    <Button
                        size="small"
                        onClick={() => void handleCancelMeeting(meeting)}
                        disabled={isCancelLoading}
                        startIcon={<CancelScheduleSendRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            textTransform: 'none',
                            minWidth: 0,
                            color: '#f0b8c0',
                            border: '1px solid rgba(227,61,79,0.3)',
                            bgcolor: 'rgba(227,61,79,0.1)',
                            borderRadius: appRadii.control,
                            px: 1,
                            '&:hover': { bgcolor: 'rgba(227,61,79,0.18)' },
                        }}
                    >
                        {isCancelLoading ? 'Cancelling...' : 'Cancel'}
                    </Button>
                )}

                <Button
                    size="small"
                    onClick={() => void handleJoinMeeting(meeting)}
                    disabled={!availability.allowed || isJoinLoading}
                    startIcon={<VideocamRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                        textTransform: 'none',
                        minWidth: 0,
                        color: availability.allowed ? '#dff5e7' : '#8a9098',
                        border: availability.allowed
                            ? '1px solid rgba(56,200,114,0.35)'
                            : '1px solid #222222',
                        bgcolor: availability.allowed
                            ? 'rgba(56,200,114,0.14)'
                            : 'rgba(255,255,255,0.03)',
                        borderRadius: appRadii.control,
                        px: 1,
                        '&:hover': {
                            bgcolor: availability.allowed
                                ? 'rgba(56,200,114,0.2)'
                                : 'rgba(255,255,255,0.05)',
                        },
                        '&.Mui-disabled': {
                            color: '#6f757e',
                            borderColor: '#212121',
                            bgcolor: 'rgba(255,255,255,0.02)',
                        },
                    }}
                >
                    {isJoinLoading
                        ? 'Joining...'
                        : availability.allowed
                            ? meeting.status === 'started'
                                ? 'Rejoin call'
                                : 'Join meeting'
                            : availability.reason || 'Not ready'}
                </Button>
            </Stack>
        );
    };

    const renderMeetingRow = (meeting: DbChatScheduledMeeting, highlight = false) => {
        const channelName =
            meeting.visibility === 'public'
                ? 'External guest meeting'
                : channels.find((channel) => channel.id === meeting.channelId)?.name || 'channel';
        const status = statusColor(meeting.status);

        return (
            <Box
                key={String(meeting.id)}
                sx={{
                    p: highlight ? 1.2 : 0,
                    borderRadius: highlight ? appRadii.card : 0,
                    border: highlight ? '1px solid #1e1e1e' : 'none',
                    bgcolor: highlight ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}
            >
                <Stack spacing={0.95}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.2}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                sx={{
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.84rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {meeting.title}
                            </Typography>
                            <Typography sx={{ color: '#858585', fontSize: '0.72rem' }}>
                                {meeting.visibility === 'public' ? 'Guest link' : `#${channelName}`} • {formatDateTime(meeting.scheduledAt)}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.7}>
                            <Chip
                                label={meeting.visibility === 'public' ? 'External' : 'Channel'}
                                size="small"
                                sx={{
                                    bgcolor: meeting.visibility === 'public' ? 'rgba(112,138,255,0.16)' : 'rgba(255,255,255,0.1)',
                                    color: meeting.visibility === 'public' ? '#c9d7ff' : '#c3c8d3',
                                    fontWeight: 700,
                                    '& .MuiChip-label': { px: 0.8, fontSize: '0.62rem' },
                                }}
                            />
                            <Chip
                                label={status.label}
                                size="small"
                                sx={{
                                    bgcolor: status.bg,
                                    color: status.color,
                                    fontWeight: 700,
                                    '& .MuiChip-label': { px: 0.9, fontSize: '0.65rem' },
                                }}
                            />
                        </Stack>
                    </Stack>

                    {meeting.description.trim() && (
                        <Typography sx={{ color: '#b7beca', fontSize: '0.75rem', lineHeight: 1.5 }}>
                            {meeting.description}
                        </Typography>
                    )}

                    {renderMeetingActions(meeting)}
                </Stack>
            </Box>
        );
    };

    const meetingSidebar = (
        <MeetingsSidebar
            mode={meetingVisibility}
            onModeChange={setMeetingVisibility}
            upcomingCount={upcomingCount}
            liveCount={liveCount}
            publicCount={publicCount}
        />
    );

    return (
        <DashboardLayout orgName={orgName} chatSidebar={meetingSidebar}>
            <MeetingsPageShell hideHeader>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', xl: '1.35fr 0.9fr' },
                            gap: 2,
                        }}
                    >
                        <Stack spacing={2}>
                            <MeetingsPanel
                                title="Booking page setup"
                                description="Control the external scheduling form and public booking link from the same workspace."
                                action={
                                    <Stack direction="row" spacing={0.8}>
                                        <Button
                                            size="small"
                                            onClick={() => void navigate({ to: '/meetings/settings' })}
                                            startIcon={<SettingsRoundedIcon sx={{ fontSize: 14 }} />}
                                            sx={meetingsSecondaryButtonSx}
                                        >
                                            Form settings
                                        </Button>
                                        {publicBookingHref ? (
                                            <Button
                                                size="small"
                                                component="a"
                                                href={publicBookingHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                                                sx={{
                                                    ...meetingsPrimaryButtonSx,
                                                    bgcolor: 'rgba(114,138,255,0.14)',
                                                    color: '#d8e1ff',
                                                    border: '1px solid rgba(114,138,255,0.28)',
                                                    '&:hover': { bgcolor: 'rgba(114,138,255,0.2)' },
                                                }}
                                            >
                                                Public link
                                            </Button>
                                        ) : null}
                                    </Stack>
                                }
                            >
                                <Stack spacing={1.15}>
                                    <Box
                                        sx={{
                                            p: 1.15,
                                            borderRadius: appRadii.card,
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            bgcolor: 'rgba(255,255,255,0.02)',
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                            <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                                                <Stack direction="row" spacing={0.7} alignItems="center">
                                                    <LinkRoundedIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                                                    <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 700 }}>
                                                        {myProfile?.headline?.trim() || 'Booking page profile'}
                                                    </Typography>
                                                </Stack>
                                                <Typography
                                                    sx={{
                                                        color: publicBookingHref ? '#8fa2c7' : '#666666',
                                                        fontSize: '0.72rem',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {publicBookingHref ? publicBookingHref : 'Add a public handle in form settings to publish your page'}
                                                </Typography>
                                            </Stack>
                                            <Chip
                                                label={myProfile?.bookingEnabled && publicBookingHref ? 'Live' : 'Draft'}
                                                size="small"
                                                sx={{
                                                    bgcolor: myProfile?.bookingEnabled && publicBookingHref ? 'rgba(56,200,114,0.18)' : 'rgba(255,255,255,0.12)',
                                                    color: myProfile?.bookingEnabled && publicBookingHref ? '#aeeec7' : '#d5dbe7',
                                                    fontWeight: 700,
                                                    '& .MuiChip-label': { px: 0.8, fontSize: '0.62rem' },
                                                }}
                                            />
                                        </Stack>
                                    </Box>

                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
                                            gap: 0.9,
                                        }}
                                    >
                                        <Box sx={{ p: 1.05, borderRadius: appRadii.card, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                                            <Typography sx={{ color: '#8d97a7', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                Active event types
                                            </Typography>
                                            <Typography sx={{ color: '#ffffff', fontSize: '1rem', fontWeight: 800, mt: 0.35 }}>
                                                {activeBookingEventTypeCount}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.05, borderRadius: appRadii.card, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                                            <Typography sx={{ color: '#8d97a7', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                Approval forms
                                            </Typography>
                                            <Typography sx={{ color: '#ffffff', fontSize: '1rem', fontWeight: 800, mt: 0.35 }}>
                                                {approvalEventTypeCount}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.05, borderRadius: appRadii.card, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                                            <Typography sx={{ color: '#8d97a7', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                External visibility
                                            </Typography>
                                            <Typography sx={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: 700, mt: 0.42 }}>
                                                {myProfile?.bookingEnabled && publicBookingHref ? 'Published' : 'Not published'}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Typography sx={{ color: '#8b94a5', fontSize: '0.72rem', lineHeight: 1.55 }}>
                                        Use form settings to control headline, handle, event types, approval rules, and the external booking experience.
                                    </Typography>
                                </Stack>
                            </MeetingsPanel>

                            <MeetingsPanel
                                title="Schedule meeting"
                                description="Set the room, timing, and access model. Channel meetings stay inside team chat. External meetings generate guest links."
                            >
                                <Stack spacing={1.25}>
                                    <TextField
                                        select
                                        label="Meeting visibility"
                                        value={meetingVisibility}
                                        onChange={(event) => setMeetingVisibility(event.target.value as MeetingVisibility)}
                                        fullWidth
                                        size="small"
                                        sx={meetingsInputSx}
                                    >
                                        <MenuItem value="channel">Channel-specific</MenuItem>
                                        <MenuItem value="public">External guests via link</MenuItem>
                                    </TextField>

                                    {meetingVisibility === 'channel' && (
                                        <TextField
                                            select
                                            label="Channel"
                                            value={selectedChannelId}
                                            onChange={(event) => setSelectedChannelId(event.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={meetingsInputSx}
                                        >
                                            {myChannels.map((channel) => (
                                                <MenuItem key={String(channel.id)} value={String(channel.id)}>
                                                    #{channel.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}

                                    <TextField
                                        label="Meeting name"
                                        value={meetingTitle}
                                        onChange={(event) => setMeetingTitle(event.target.value)}
                                        placeholder="Weekly sync"
                                        fullWidth
                                        size="small"
                                        sx={meetingsInputSx}
                                    />

                                    <TextField
                                        label="Description"
                                        value={meetingDescription}
                                        onChange={(event) => setMeetingDescription(event.target.value)}
                                        placeholder="Agenda, owner, and decisions to make"
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        size="small"
                                        sx={meetingsInputSx}
                                    />

                                    <TextField
                                        label="Scheduled for"
                                        type="datetime-local"
                                        value={scheduledFor}
                                        onChange={(event) => setScheduledFor(event.target.value)}
                                        fullWidth
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                        sx={meetingsInputSx}
                                    />

                                    <Stack direction="row" justifyContent="flex-end">
                                        <Button
                                            onClick={() => void handleScheduleMeeting()}
                                            disabled={
                                                isCreating ||
                                                !meetingTitle.trim() ||
                                                (meetingVisibility === 'channel' && !selectedChannelId)
                                            }
                                            variant="contained"
                                            sx={meetingsPrimaryButtonSx}
                                        >
                                            {isCreating ? 'Scheduling...' : 'Schedule Meeting'}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </MeetingsPanel>
                        </Stack>

                        <Stack spacing={2}>
                            <MeetingsPanel
                                title="Meetings feed"
                                description="Urgent meetings first, then the full list in one place."
                                action={
                                    <Stack direction="row" spacing={0.8}>
                                        <Button
                                            size="small"
                                            onClick={() => void navigate({ to: '/meetings/calendar' })}
                                            sx={meetingsSecondaryButtonSx}
                                        >
                                            Calendar
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => void navigate({ to: '/meetings/settings' })}
                                            sx={meetingsSecondaryButtonSx}
                                        >
                                            Settings
                                        </Button>
                                    </Stack>
                                }
                            >
                                <Stack spacing={1}>
                                    {meetingsForUser.length === 0 ? (
                                        <Typography sx={{ color: '#666666', fontSize: '0.82rem', py: 1.5 }}>
                                            No meetings scheduled yet.
                                        </Typography>
                                    ) : (
                                        <>
                                            {actionQueueMeetings.length > 0 && (
                                                <Box
                                                    sx={{
                                                        p: 1.2,
                                                        borderRadius: appRadii.card,
                                                        border: '1px solid rgba(56,200,114,0.18)',
                                                        bgcolor: 'rgba(56,200,114,0.04)',
                                                    }}
                                                >
                                                    <Typography sx={{ color: '#dff5e7', fontSize: '0.76rem', fontWeight: 700, mb: 0.9 }}>
                                                        Needs attention now
                                                    </Typography>
                                                    <Stack spacing={0.9}>
                                                        {actionQueueMeetings.map((meeting) => renderMeetingRow(meeting, true))}
                                                    </Stack>
                                                </Box>
                                            )}

                                            {actionQueueMeetings.length > 0 && (
                                                <Typography sx={{ color: '#8b94a5', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', pt: 0.4 }}>
                                                    All meetings
                                                </Typography>
                                            )}

                                            <Stack spacing={1.05}>
                                                {meetingsForUser.map((meeting, index) => (
                                                    <Box key={String(meeting.id)}>
                                                        {index > 0 && <Divider sx={{ borderColor: '#111111', mb: 1 }} />}
                                                        {renderMeetingRow(meeting)}
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </>
                                    )}

                                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                    </Stack>
                                </Stack>
                            </MeetingsPanel>
                        </Stack>
                    </Box>
            </MeetingsPageShell>
        </DashboardLayout>
    );
}
