import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useNavigate } from '@tanstack/react-router';
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
    MeetingPublicProfile as DbMeetingPublicProfile,
    OrganizationMember as DbOrganizationMember,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';
import { createDyteMeetingAccess, createPublicMeetingInviteLink, joinDyteMeetingAccess } from '../../server/dyte';
import { sendMeetingEmail } from '../../server/meetings';
import { setActiveCallSnapshot } from '../../lib/activeCall';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import { MeetingsSidebar } from './MeetingsSidebar';
import { CalendarDayCell } from './MeetingCalendarComponents';
import {
    MeetingsPageShell,
    MeetingsPanel,
    meetingsInputSx,
    meetingsPrimaryButtonSx,
    meetingsSecondaryButtonSx,
} from './MeetingsUI';

const NONE_U64 = 18446744073709551615n;
const JOIN_LEAD_MS = 10 * 60 * 1000;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
type MeetingVisibility = 'channel' | 'public';
interface MeetingEditDraft {
    title: string;
    description: string;
    visibility: MeetingVisibility;
    channelId: string;
    scheduledFor: string;
}

function dateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toUtcIcsDate(timestamp: number): string {
    const date = new Date(timestamp);
    const iso = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return iso;
}

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
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

function toDateTimeLocalValue(timestampMs: number): string {
    const date = new Date(timestampMs);
    const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    const local = new Date(timestampMs - tzOffsetMs);
    return local.toISOString().slice(0, 16);
}

function avatarColorForName(name: string): string {
    const colors = ['#5B8DEF', '#F97316', '#14B8A6', '#EF4444', '#8B5CF6', '#10B981'];
    const normalized = name.trim() || 'Timey';
    const total = normalized.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[total % colors.length];
}

function startOfWeek(date: Date): Date {
    const result = new Date(date);
    const diff = result.getDay();
    result.setDate(result.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function toIcsContent(meetings: DbChatScheduledMeeting[], channelsById: Map<string, DbChatChannel>): string {
    const nowStamp = toUtcIcsDate(Date.now());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Timey//Meetings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    for (const meeting of meetings) {
        if (meeting.status === 'cancelled') continue;
        const startMs = Number(meeting.scheduledAt);
        const endMs = startMs + 30 * 60 * 1000;
        const channelLabel =
            meeting.visibility === 'public'
                ? 'Public Meeting'
                : `#${channelsById.get(String(meeting.channelId))?.name || 'channel'}`;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:timey-${String(meeting.id)}@timey.local`);
        lines.push(`DTSTAMP:${nowStamp}`);
        lines.push(`DTSTART:${toUtcIcsDate(startMs)}`);
        lines.push(`DTEND:${toUtcIcsDate(endMs)}`);
        lines.push(`SUMMARY:${escapeIcsText(meeting.title)}`);
        lines.push(`DESCRIPTION:${escapeIcsText(meeting.description || '')}`);
        lines.push(`LOCATION:${escapeIcsText(channelLabel)}`);
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
}

function downloadIcs(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function MeetingCalendarPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership, membershipUnavailable } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const navigate = useNavigate();

    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allOrganizationMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');
    const [allCallSessions] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_call_session : 'skip');
    const [allOrganizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [allProfiles] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_public_profile : 'skip');

    const createScheduledMeetingReducer = useReducer(reducers.createScheduledMeeting);
    const cancelScheduledMeetingReducer = useReducer(reducers.cancelScheduledMeeting);
    const joinScheduledMeetingReducer = useReducer(reducers.joinScheduledMeeting);
    const rescheduleScheduledMeetingReducer = useReducer(reducers.rescheduleScheduledMeeting);
    const updateScheduledMeetingReducer = useReducer(reducers.updateScheduledMeeting);

    const users = (allUsers || []) as DbUser[];
    const channels = (allChannels || []) as DbChatChannel[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const organizationMembers = (allOrganizationMembers || []) as DbOrganizationMember[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];
    const callSessions = (allCallSessions || []) as DbChatCallSession[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];

    const [calendarDate, setCalendarDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
    const [joiningMeetingId, setJoiningMeetingId] = useState<bigint | null>(null);
    const [reschedulingMeetingId, setReschedulingMeetingId] = useState<bigint | null>(null);
    const [draggingMeetingId, setDraggingMeetingId] = useState<bigint | null>(null);
    const [meetingVisibility, setMeetingVisibility] = useState<MeetingVisibility>('channel');
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDescription, setMeetingDescription] = useState('');
    const [scheduledFor, setScheduledFor] = useState(() => toDateTimeLocalValue(Date.now() + 30 * 60 * 1000));
    const [isCreating, setIsCreating] = useState(false);
    const [editingMeetingId, setEditingMeetingId] = useState<bigint | null>(null);
    const [editingDraft, setEditingDraft] = useState<MeetingEditDraft | null>(null);
    const [updatingMeetingId, setUpdatingMeetingId] = useState<bigint | null>(null);
    const [cancellingMeetingId, setCancellingMeetingId] = useState<bigint | null>(null);
    const [selectedDayDialogOpen, setSelectedDayDialogOpen] = useState(false);
    const [sharingMeetingId, setSharingMeetingId] = useState<bigint | null>(null);

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

    const isOrgOwner = currentMembership?.role === 'owner';

    const channelsById = useMemo(() => {
        const map = new Map<string, DbChatChannel>();
        for (const channel of channels) map.set(String(channel.id), channel);
        return map;
    }, [channels]);

    const usersById = useMemo(() => {
        const map = new Map<string, DbUser>();
        for (const user of users) map.set(String(user.id), user);
        return map;
    }, [users]);

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

    const channelMemberCountById = useMemo(() => {
        const map = new Map<string, number>();
        for (const member of channelMembers) {
            const key = String(member.channelId);
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    }, [channelMembers]);

    const orgMemberCount = useMemo(() => {
        if (orgId == null) return 0;
        return organizationMembers.filter((member) => member.orgId === orgId).length;
    }, [orgId, organizationMembers]);

    const selectedChannel = myChannels.find((channel) => String(channel.id) === selectedChannelId) || null;

    const meetingsForUser = useMemo(() => {
        if (orgId == null) return [];
        return scheduledMeetings
            .filter((meeting) => {
                if (meeting.orgId !== orgId) return false;
                if (meeting.visibility === 'public') return true;
                return myChannelIds.has(String(meeting.channelId));
            })
            .sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt));
    }, [myChannelIds, orgId, scheduledMeetings]);

    const liveCount = useMemo(() => meetingsForUser.filter((m) => m.status === 'started').length, [meetingsForUser]);
    const publicCount = useMemo(() => meetingsForUser.filter((m) => m.visibility === 'public').length, [meetingsForUser]);
    const upcomingCount = useMemo(() => meetingsForUser.filter((m) => m.status === 'scheduled' && Number(m.scheduledAt) >= Date.now()).length, [meetingsForUser]);

    const meetingsByDayKey = useMemo(() => {
        const map = new Map<string, DbChatScheduledMeeting[]>();
        for (const meeting of meetingsForUser) {
            const key = dateKey(new Date(Number(meeting.scheduledAt)));
            const list = map.get(key) || [];
            list.push(meeting);
            map.set(key, list);
        }
        for (const [key, rows] of map.entries()) {
            map.set(key, rows.sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt)));
        }
        return map;
    }, [meetingsForUser]);

    const conflictMeetingIds = useMemo(() => {
        const ids = new Set<string>();
        for (const rows of meetingsByDayKey.values()) {
            for (let index = 1; index < rows.length; index += 1) {
                const previous = rows[index - 1];
                const current = rows[index];
                const previousEnd = Number(previous.scheduledAt) + 30 * 60 * 1000;
                if (Number(current.scheduledAt) < previousEnd) {
                    ids.add(String(previous.id));
                    ids.add(String(current.id));
                }
            }
        }
        return ids;
    }, [meetingsByDayKey]);

    const selectedDayKey = dateKey(selectedDate);
    const meetingsInSelectedDay = meetingsByDayKey.get(selectedDayKey) || [];

    const calendarCells = useMemo(() => {
        const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
        const todayKey = dateKey(new Date());
        const gridStart = addDays(monthStart, -monthStart.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const cellDate = addDays(gridStart, index);
            const key = dateKey(cellDate);
            const rows = meetingsByDayKey.get(key) || [];
            return {
                date: cellDate,
                day: cellDate.getDate(),
                key,
                meetings: rows,
                count: rows.length,
                liveCount: rows.filter((meeting) => meeting.status === 'started').length,
                publicCount: rows.filter((meeting) => meeting.visibility === 'public').length,
                conflictCount: rows.filter((meeting) => conflictMeetingIds.has(String(meeting.id))).length,
                isToday: key === todayKey,
                isSelected: key === selectedDayKey,
                inCurrentMonth: cellDate.getMonth() === calendarDate.getMonth(),
            };
        });
    }, [calendarDate, conflictMeetingIds, meetingsByDayKey, selectedDayKey]);

    const meetingsInMonth = useMemo(() => {
        return meetingsForUser.filter((meeting) => {
            const when = new Date(Number(meeting.scheduledAt));
            return when.getFullYear() === calendarDate.getFullYear() && when.getMonth() === calendarDate.getMonth();
        });
    }, [calendarDate, meetingsForUser]);
    const selectedDateLabel = selectedDate.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    const currentMonthLabel = calendarDate.toLocaleString([], { month: 'long', year: 'numeric' });
    const selectedDayLiveCount = meetingsInSelectedDay.filter((meeting) => meeting.status === 'started').length;
    const selectedDayPublicCount = meetingsInSelectedDay.filter((meeting) => meeting.visibility === 'public').length;
    const selectedDayConflictCount = meetingsInSelectedDay.filter((meeting) => conflictMeetingIds.has(String(meeting.id))).length;
    const selectedDayUpcomingCount = meetingsInSelectedDay.filter(
        (meeting) => meeting.status === 'scheduled' && Number(meeting.scheduledAt) >= Date.now()
    ).length;

    const weekDays = useMemo(() => {
        const start = startOfWeek(selectedDate);
        return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }, [selectedDate]);

    const meetingsInWeek = useMemo(() => {
        const start = startOfWeek(selectedDate).getTime();
        const end = addDays(startOfWeek(selectedDate), 7).getTime();
        return meetingsForUser.filter((meeting) => {
            const ts = Number(meeting.scheduledAt);
            return ts >= start && ts < end;
        });
    }, [meetingsForUser, selectedDate]);

    const visibleMeetings = useMemo(() => {
        if (calendarView === 'month') return meetingsInMonth;
        if (calendarView === 'week') return meetingsInWeek;
        if (calendarView === 'day') return meetingsInSelectedDay;
        return meetingsForUser;
    }, [calendarView, meetingsForUser, meetingsInMonth, meetingsInSelectedDay, meetingsInWeek]);

    const activeCallByMeetingId = useMemo(() => {
        const map = new Map<string, DbChatCallSession>();
        for (const session of callSessions) {
            if (session.status !== 'active' || session.endedAt !== NONE_U64) continue;
            map.set(session.dyteMeetingId, session);
        }
        return map;
    }, [callSessions]);

    const canJoinMeeting = (meeting: DbChatScheduledMeeting): { allowed: boolean; reason: string | null } => {
        if (meeting.status === 'cancelled') return { allowed: false, reason: 'Cancelled' };
        if (meeting.status === 'ended') return { allowed: false, reason: 'Ended' };

        const now = Date.now();
        const scheduledAt = Number(meeting.scheduledAt);
        const joinOpenAt = scheduledAt - JOIN_LEAD_MS;
        if (now < joinOpenAt) {
            const mins = Math.max(1, Math.ceil((joinOpenAt - now) / 60000));
            return { allowed: false, reason: `${mins}m` };
        }

        return { allowed: true, reason: null };
    };

    const canManageMeeting = (meeting: DbChatScheduledMeeting): boolean => {
        if (!currentUser) return false;
        if (meeting.status !== 'scheduled') return false;
        return isOrgOwner || meeting.createdByUserId === currentUser.id;
    };

    const collectRecipients = (visibility: MeetingVisibility, channelId: bigint | null) => {
        if (!currentUser || orgId == null) return [] as DbUser[];

        const recipientIds = new Set<string>();
        if (visibility === 'channel' && channelId != null && channelId !== NONE_U64) {
            for (const member of channelMembers) {
                if (member.channelId === channelId && member.userId !== currentUser.id) {
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

        return users.filter((user) => recipientIds.has(String(user.id)) && user.email.includes('@'));
    };

    const exportVisibleAsIcs = () => {
        if (visibleMeetings.length === 0) {
            toast.message('No meetings in this view');
            return;
        }
        const content = toIcsContent(visibleMeetings, channelsById);
        const todayStamp = new Date().toISOString().slice(0, 10);
        downloadIcs(`timey-${calendarView}-${todayStamp}.ics`, content);
        toast.success('Calendar export downloaded');
    };

    const exportOneAsIcs = (meeting: DbChatScheduledMeeting) => {
        const content = toIcsContent([meeting], channelsById);
        downloadIcs(`meeting-${String(meeting.id)}.ics`, content);
        toast.success('Meeting ICS downloaded');
    };

    const handleJoinMeeting = async (meeting: DbChatScheduledMeeting) => {
        if (!currentUser) return;

        const availability = canJoinMeeting(meeting);
        if (!availability.allowed) {
            toast.message(availability.reason || 'Not joinable yet');
            return;
        }

        const fallbackUiChannelId =
            meeting.channelId !== NONE_U64
                ? meeting.channelId
                : (channels.find((channel) => channel.orgId === meeting.orgId)?.id ?? 0n);
        if (fallbackUiChannelId === 0n) {
            toast.message('Open this meeting from chat context after selecting a channel.');
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
                toast.error(joinResult.error || 'Could not join meeting');
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
                channelId: String(fallbackUiChannelId),
                meetingId: meeting.dyteMeetingId,
                callSessionId: callSessionId == null ? null : String(callSessionId),
            });

            void navigate({ to: '/chat' });
            toast.success('Meeting opened in chat');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not join meeting');
        } finally {
            setJoiningMeetingId(null);
        }
    };

    const handleDropReschedule = async (meetingId: bigint, targetKey: string) => {
        const meeting = meetingsForUser.find((row) => row.id === meetingId);
        if (!meeting) return;
        if (!canManageMeeting(meeting)) {
            toast.message('Only organizer or owner can reschedule');
            return;
        }

        const [year, month, day] = targetKey.split('-').map((part) => Number(part));
        const previous = new Date(Number(meeting.scheduledAt));
        const nextDate = new Date(year, month - 1, day, previous.getHours(), previous.getMinutes(), 0, 0);
        const nextTimestamp = nextDate.getTime();
        if (!Number.isFinite(nextTimestamp)) return;

        setReschedulingMeetingId(meeting.id);
        try {
            await rescheduleScheduledMeetingReducer({
                meetingId: meeting.id,
                scheduledAt: BigInt(nextTimestamp),
            });
            toast.success('Meeting moved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not move meeting');
        } finally {
            setReschedulingMeetingId(null);
            setDraggingMeetingId(null);
        }
    };

    const alignDraftToSelectedDate = () => {
        const now = new Date();
        const parsed = scheduledFor ? new Date(scheduledFor) : now;
        const next = new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            Number.isFinite(parsed.getTime()) ? parsed.getHours() : Math.max(9, now.getHours()),
            Number.isFinite(parsed.getTime()) ? parsed.getMinutes() : 0,
            0,
            0
        );
        if (next.getTime() <= Date.now() + 60_000) {
            next.setHours(now.getHours(), Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
        }
        setScheduledFor(toDateTimeLocalValue(next.getTime()));
    };

    const handleCreateMeeting = async () => {
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
            toast.error('Please choose a valid date and time.');
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

            const recipients = collectRecipients(meetingVisibility, selectedChannel?.id ?? null);
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
                                joinContext:
                                    meetingVisibility === 'channel' && selectedChannel
                                        ? `#${selectedChannel.name}`
                                        : 'Guest invite link',
                            } as any,
                        })
                    )
                );
            }

            toast.success('Meeting scheduled successfully.');
            setMeetingTitle('');
            setMeetingDescription('');
            setSelectedDate(new Date(scheduledAtMs));
            setCalendarDate(new Date(new Date(scheduledAtMs).getFullYear(), new Date(scheduledAtMs).getMonth(), 1));
            setScheduledFor(toDateTimeLocalValue(Date.now() + 30 * 60 * 1000));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not schedule meeting');
        } finally {
            setIsCreating(false);
        }
    };

    const beginEditMeeting = (meeting: DbChatScheduledMeeting) => {
        setEditingMeetingId(meeting.id);
        setEditingDraft({
            title: meeting.title,
            description: meeting.description || '',
            visibility: meeting.visibility as MeetingVisibility,
            channelId: meeting.channelId === NONE_U64 ? '' : String(meeting.channelId),
            scheduledFor: toDateTimeLocalValue(Number(meeting.scheduledAt)),
        });
    };

    const handleUpdateMeeting = async (meeting: DbChatScheduledMeeting) => {
        if (!editingDraft) return;

        const title = editingDraft.title.trim();
        if (!title) {
            toast.error('Meeting name is required.');
            return;
        }

        if (editingDraft.visibility === 'channel' && !editingDraft.channelId) {
            toast.error('Choose a channel for channel-specific meetings.');
            return;
        }

        const scheduledAtMs = new Date(editingDraft.scheduledFor).getTime();
        if (!Number.isFinite(scheduledAtMs)) {
            toast.error('Choose a valid date and time.');
            return;
        }
        if (scheduledAtMs <= Date.now() + 60_000) {
            toast.error('Meeting must be at least 1 minute in the future.');
            return;
        }

        const nextChannel =
            editingDraft.visibility === 'channel'
                ? myChannels.find((channel) => String(channel.id) === editingDraft.channelId) || null
                : null;

        setUpdatingMeetingId(meeting.id);
        try {
            await updateScheduledMeetingReducer({
                meetingId: meeting.id,
                channelId: nextChannel?.id ?? NONE_U64,
                visibility: editingDraft.visibility,
                title,
                description: editingDraft.description.trim(),
                scheduledAt: BigInt(scheduledAtMs),
            });

            const recipients = collectRecipients(editingDraft.visibility, nextChannel?.id ?? null);
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
                                joinContext:
                                    editingDraft.visibility === 'channel' && nextChannel
                                        ? `#${nextChannel.name}`
                                        : 'Guest invite link',
                            } as any,
                        })
                    )
                );
            }

            toast.success('Meeting updated.');
            setEditingMeetingId(null);
            setEditingDraft(null);
            setSelectedDate(new Date(scheduledAtMs));
            setCalendarDate(new Date(new Date(scheduledAtMs).getFullYear(), new Date(scheduledAtMs).getMonth(), 1));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update meeting');
        } finally {
            setUpdatingMeetingId(null);
        }
    };

    const handleCancelMeeting = async (meeting: DbChatScheduledMeeting) => {
        setCancellingMeetingId(meeting.id);
        try {
            await cancelScheduledMeetingReducer({ meetingId: meeting.id });
            toast.success('Meeting cancelled.');
            if (editingMeetingId === meeting.id) {
                setEditingMeetingId(null);
                setEditingDraft(null);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not cancel meeting');
        } finally {
            setCancellingMeetingId(null);
        }
    };

    const jumpToToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    const openSelectedDayDialog = (date: Date) => {
        setSelectedDate(date);
        setCalendarDate(new Date(date.getFullYear(), date.getMonth(), 1));
        setSelectedDayDialogOpen(true);
    };

    const closeSelectedDayDialog = () => {
        setSelectedDayDialogOpen(false);
        setEditingMeetingId(null);
        setEditingDraft(null);
    };

    const handleCopyGuestInvite = async (meeting: DbChatScheduledMeeting) => {
        if (meeting.visibility !== 'public') return;

        setSharingMeetingId(meeting.id);
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

    const meetingsSelectMenuProps = {
        PaperProps: {
            sx: {
                bgcolor: chatColors.panelAltBg,
                color: chatColors.textPrimary,
                border: `1px solid ${chatColors.border}`,
                boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
                '& .MuiMenuItem-root': {
                    color: chatColors.textPrimary,
                    fontSize: '0.84rem',
                },
                '& .MuiMenuItem-root:hover': {
                    bgcolor: chatColors.hover,
                },
                '& .MuiMenuItem-root.Mui-selected': {
                    bgcolor: chatColors.selection,
                },
                '& .MuiMenuItem-root.Mui-selected:hover': {
                    bgcolor: chatColors.selectionStrong,
                },
            },
        },
    } as const;

    const renderMeetingCard = (meeting: DbChatScheduledMeeting, dense = false) => {
        const channelName =
            meeting.visibility === 'public'
                ? 'External guest meeting'
                : channelsById.get(String(meeting.channelId))?.name || 'channel';
        const joinInfo = canJoinMeeting(meeting);
        const joining = joiningMeetingId === meeting.id;
        const moving = reschedulingMeetingId === meeting.id;
        const hasConflict = conflictMeetingIds.has(String(meeting.id));
        const isEnded = meeting.status === 'ended';
        const isCancelled = meeting.status === 'cancelled';
        const cardBorder = hasConflict
            ? '1px solid rgba(227,61,79,0.24)'
            : isEnded
              ? `1px solid ${chatColors.borderStrong}`
              : isCancelled
                ? '1px solid rgba(227,61,79,0.2)'
                : `1px solid ${chatColors.border}`;
        const cardBg = hasConflict
            ? 'rgba(227,61,79,0.05)'
            : isEnded
              ? 'rgba(255,255,255,0.01)'
              : isCancelled
                ? 'rgba(227,61,79,0.04)'
                : 'rgba(255,255,255,0.02)';
        const titleColor = isEnded || isCancelled ? '#c8d0dc' : '#f0f4ff';
        const metaColor = isEnded || isCancelled ? '#747d8c' : '#8f98a8';

        return (
            <Box
                key={String(meeting.id)}
                draggable={canManageMeeting(meeting)}
                onDragStart={() => setDraggingMeetingId(meeting.id)}
                onDragEnd={() => setDraggingMeetingId(null)}
                sx={{
                    border: cardBorder,
                    borderRadius: appRadii.card,
                    p: dense ? 0.85 : 1,
                    bgcolor: cardBg,
                    cursor: canManageMeeting(meeting) ? 'grab' : 'default',
                    opacity: moving ? 0.72 : 1,
                }}
            >
                <Typography sx={{ color: titleColor, fontSize: dense ? '0.74rem' : '0.78rem', fontWeight: 700 }}>
                    {meeting.title}
                </Typography>
                <Typography sx={{ color: metaColor, fontSize: dense ? '0.64rem' : '0.68rem', mb: 0.7 }}>
                    {meeting.visibility === 'public' ? 'Guest link' : `#${channelName}`} • {formatDateTime(meeting.scheduledAt)}
                </Typography>

                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.7}>
                    <Stack direction="row" spacing={0.55}>
                        <Chip
                            size="small"
                            label={meeting.visibility === 'public' ? 'External' : 'Channel'}
                            sx={{
                                bgcolor: meeting.visibility === 'public' ? 'rgba(112,138,255,0.16)' : 'rgba(255,255,255,0.08)',
                                color: '#cad2df',
                                '& .MuiChip-label': { fontSize: '0.58rem' },
                            }}
                        />
                        {canManageMeeting(meeting) && meeting.status === 'scheduled' && (
                            <Chip
                                size="small"
                                label="Drag"
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#9ba4b3',
                                    '& .MuiChip-label': { fontSize: '0.58rem' },
                                }}
                            />
                        )}
                        {hasConflict ? (
                            <Chip
                                size="small"
                                label="Conflict"
                                sx={{
                                    bgcolor: 'rgba(227,61,79,0.14)',
                                    color: '#f2b7c0',
                                    '& .MuiChip-label': { fontSize: '0.58rem', fontWeight: 700 },
                                }}
                            />
                        ) : null}
                        {isEnded ? (
                            <Chip
                                size="small"
                                label="Ended"
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.06)',
                                    color: '#b8c0ce',
                                    '& .MuiChip-label': { fontSize: '0.58rem', fontWeight: 700 },
                                }}
                            />
                        ) : null}
                        {isCancelled ? (
                            <Chip
                                size="small"
                                label="Cancelled"
                                sx={{
                                    bgcolor: 'rgba(227,61,79,0.12)',
                                    color: '#f2b7c0',
                                    '& .MuiChip-label': { fontSize: '0.58rem', fontWeight: 700 },
                                }}
                            />
                        ) : null}
                    </Stack>

                    <Stack direction="row" spacing={0.5}>
                        {meeting.visibility === 'public' ? (
                            <Button
                                size="small"
                                startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
                                onClick={() => void handleCopyGuestInvite(meeting)}
                                disabled={sharingMeetingId === meeting.id}
                                sx={{
                                    textTransform: 'none',
                                    minWidth: 0,
                                    px: 0.8,
                                    fontSize: '0.62rem',
                                    color: '#d7e1ff',
                                    border: '1px solid rgba(114,138,255,0.28)',
                                    bgcolor: 'rgba(114,138,255,0.1)',
                                }}
                            >
                                {sharingMeetingId === meeting.id ? 'Copying...' : 'Guest link'}
                            </Button>
                        ) : null}
                        <Button
                            size="small"
                            startIcon={<DownloadRoundedIcon sx={{ fontSize: 13 }} />}
                            onClick={() => exportOneAsIcs(meeting)}
                            sx={{
                                textTransform: 'none',
                                minWidth: 0,
                                px: 0.8,
                                fontSize: '0.62rem',
                                color: '#b8c0ce',
                                border: '1px solid #222222',
                                bgcolor: 'rgba(255,255,255,0.03)',
                            }}
                        >
                            ICS
                        </Button>
                        <Button
                            size="small"
                            startIcon={<VideocamRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => void handleJoinMeeting(meeting)}
                            disabled={joining || !joinInfo.allowed}
                            sx={{
                                textTransform: 'none',
                                minWidth: 0,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: joinInfo.allowed ? '#dff5e7' : '#89909c',
                                border: joinInfo.allowed
                                    ? '1px solid rgba(56,200,114,0.35)'
                                    : '1px solid #222222',
                                bgcolor: joinInfo.allowed
                                    ? 'rgba(56,200,114,0.14)'
                                    : 'rgba(255,255,255,0.03)',
                            }}
                        >
                            {joining ? 'Joining...' : joinInfo.allowed ? 'Join' : joinInfo.reason || 'Not ready'}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        );
    };

    const describeMeetingTone = (meeting: DbChatScheduledMeeting) => {
        if (conflictMeetingIds.has(String(meeting.id))) {
            return {
                bg: 'rgba(227,61,79,0.1)',
                border: '1px solid rgba(227,61,79,0.18)',
                label: 'Conflict',
                color: '#f3b1bb',
            };
        }
        if (meeting.status === 'started') {
            return {
                bg: 'rgba(56,200,114,0.12)',
                border: '1px solid rgba(56,200,114,0.18)',
                label: 'Live',
                color: '#abefc5',
            };
        }
        if (meeting.visibility === 'public') {
            return {
                bg: 'rgba(114,138,255,0.1)',
                border: '1px solid rgba(114,138,255,0.18)',
                label: 'External',
                color: '#d7e1ff',
            };
        }
        return {
            bg: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.06)',
            label: 'Channel',
            color: '#cad2df',
        };
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
                            Direct meetings routes need the live SpacetimeDB session. Refresh once the workspace connection is back instead of being redirected away.
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
                icon={<CalendarMonthRoundedIcon sx={{ fontSize: 20 }} />}
                title="Meetings Calendar"
                description="Visualize load across month, week, day, and agenda views. Export ICS, drag to reschedule, and jump into live meetings from one timeline."
                stats={[
                    { label: 'Upcoming', value: upcomingCount, helper: 'Future meetings in scope', tone: 'accent' },
                    { label: 'Live Now', value: liveCount, helper: 'Meetings already started', tone: 'success' },
                    { label: 'External', value: publicCount, helper: 'Meetings with guest join links' },
                    { label: 'Visible', value: visibleMeetings.length, helper: `${calendarView} view inventory` },
                ]}
                actions={
                    <>
                            {([
                                { value: 'month', label: 'Month' },
                                { value: 'week', label: 'Week' },
                                { value: 'day', label: 'Day' },
                                { value: 'agenda', label: 'Agenda' },
                            ] as Array<{ value: CalendarViewMode; label: string }>).map((option) => (
                                <Button
                                    key={option.value}
                                    size="small"
                                    onClick={() => setCalendarView(option.value)}
                                    sx={{
                                        textTransform: 'none',
                                        minWidth: 0,
                                        px: 1.1,
                                        color: calendarView === option.value ? '#f1f5ff' : '#a0a9b8',
                                        border: calendarView === option.value ? '1px solid rgba(114,138,255,0.55)' : '1px solid #232323',
                                        bgcolor: calendarView === option.value ? 'rgba(114,138,255,0.2)' : 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    {option.label}
                                </Button>
                            ))}
                            <Button
                                size="small"
                                onClick={jumpToToday}
                                sx={meetingsSecondaryButtonSx}
                            >
                                Today
                            </Button>
                            <Button
                                size="small"
                                startIcon={<DownloadRoundedIcon sx={{ fontSize: 14 }} />}
                                onClick={exportVisibleAsIcs}
                                sx={{
                                    ...meetingsPrimaryButtonSx,
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#ffffff',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                                }}
                            >
                                Export View
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
                                        color: '#d7e1ff',
                                        border: '1px solid rgba(114,138,255,0.28)',
                                        '&:hover': { bgcolor: 'rgba(114,138,255,0.2)' },
                                    }}
                                >
                                    Booking Page
                                </Button>
                            ) : null}
                    </>
                }
            >

                    {(calendarView === 'month' || calendarView === 'week' || calendarView === 'day') && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography sx={{ color: '#d4d9e5', fontSize: '0.86rem', fontWeight: 700 }}>
                                {calendarView === 'month'
                                    ? currentMonthLabel
                                    : selectedDateLabel}
                            </Typography>
                            <Stack direction="row" spacing={0.3}>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        if (calendarView === 'month') {
                                            setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
                                        } else {
                                            setSelectedDate((current) => addDays(current, calendarView === 'week' ? -7 : -1));
                                        }
                                    }}
                                    sx={{ color: '#9aa3b3' }}
                                >
                                    <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        if (calendarView === 'month') {
                                            setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
                                        } else {
                                            setSelectedDate((current) => addDays(current, calendarView === 'week' ? 7 : 1));
                                        }
                                    }}
                                    sx={{ color: '#9aa3b3' }}
                                >
                                    <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Stack>
                        </Stack>
                    )}

                    {calendarView === 'month' && (
                        <>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                                <MeetingsPanel
                                    title="Calendar"
                                    description="Click any date to inspect meetings, schedule new sessions, join live calls, or drag scheduled meetings into a new day."
                                >
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                                            gap: 0.6,
                                        }}
                                    >
                                        {DAY_LABELS.map((label) => (
                                            <Typography
                                                key={label}
                                                sx={{
                                                    color: '#7d8593',
                                                    textAlign: 'center',
                                                    fontSize: '0.62rem',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {label}
                                            </Typography>
                                        ))}
                                        {calendarCells.map((cell) => (
                                            <CalendarDayCell
                                                key={cell.key}
                                                cell={cell}
                                                isDragging={draggingMeetingId != null}
                                                onDrop={() => {
                                                    if (draggingMeetingId == null) return;
                                                    void handleDropReschedule(draggingMeetingId, cell.key);
                                                }}
                                                onSelect={() => {
                                                    const [y, m, d] = cell.key.split('-').map((part) => Number(part));
                                                    openSelectedDayDialog(new Date(y, m - 1, d));
                                                }}
                                                channelsById={channelsById}
                                                usersById={usersById}
                                                currentUser={currentUser}
                                                orgMemberCount={orgMemberCount}
                                                channelMemberCountById={channelMemberCountById}
                                                describeMeetingTone={describeMeetingTone}
                                                avatarColorForName={avatarColorForName}
                                            />
                                        ))}
                                    </Box>
                                </MeetingsPanel>
                            </Box>

                            <Dialog
                                open={selectedDayDialogOpen}
                                onClose={closeSelectedDayDialog}
                                fullWidth
                                maxWidth="md"
                                scroll="paper"
                                PaperProps={{
                                    sx: {
                                        bgcolor: chatColors.panelBg,
                                        color: chatColors.textPrimary,
                                        border: `1px solid ${chatColors.border}`,
                                        borderRadius: appRadii.panel,
                                        boxShadow: '0 24px 80px rgba(0,0,0,0.42)',
                                        overflow: 'hidden',
                                    },
                                }}
                            >
                                <DialogTitle sx={{ px: 2.2, py: 1.7, borderBottom: `1px solid ${chatColors.border}` }}>
                                    <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                                        <Box>
                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '1rem', fontWeight: 800 }}>
                                                {selectedDateLabel}
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.74rem', mt: 0.35 }}>
                                                {meetingsInSelectedDay.length === 0
                                                    ? 'No meetings booked for this date yet.'
                                                    : `${meetingsInSelectedDay.length} meeting${meetingsInSelectedDay.length === 1 ? '' : 's'} scheduled on this date.`}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={0.7} alignItems="center">
                                            <Button
                                                size="small"
                                                onClick={() => void navigate({ to: '/meetings' })}
                                                sx={meetingsSecondaryButtonSx}
                                            >
                                                Manager
                                            </Button>
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    setCalendarView('day');
                                                    closeSelectedDayDialog();
                                                }}
                                                sx={meetingsSecondaryButtonSx}
                                            >
                                                Day view
                                            </Button>
                                            <IconButton
                                                size="small"
                                                onClick={closeSelectedDayDialog}
                                                sx={{
                                                    color: chatColors.textPrimary,
                                                    border: `1px solid ${chatColors.borderStrong}`,
                                                    bgcolor: chatColors.inputBg,
                                                }}
                                            >
                                                <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Stack>
                                    </Stack>
                                </DialogTitle>
                                <DialogContent sx={{ p: 2.2, bgcolor: chatColors.panelBg }}>
                                    <Stack spacing={1.1}>
                                        <Box
                                            sx={{
                                                p: 1.1,
                                                borderRadius: appRadii.card,
                                                border: `1px solid ${chatColors.border}`,
                                                bgcolor: chatColors.panelAltBg,
                                            }}
                                        >
                                            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                                <Chip
                                                    size="small"
                                                    label={`${selectedDayUpcomingCount} upcoming`}
                                                    sx={{
                                                        bgcolor: 'rgba(114,138,255,0.14)',
                                                        color: '#d7e1ff',
                                                        '& .MuiChip-label': { fontSize: '0.62rem', fontWeight: 700 },
                                                    }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={`${selectedDayLiveCount} live`}
                                                    sx={{
                                                        bgcolor: 'rgba(56,200,114,0.14)',
                                                        color: '#abefc5',
                                                        '& .MuiChip-label': { fontSize: '0.62rem', fontWeight: 700 },
                                                    }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={`${selectedDayPublicCount} external`}
                                                    sx={{
                                                        bgcolor: 'rgba(255,255,255,0.08)',
                                                        color: '#cad2df',
                                                        '& .MuiChip-label': { fontSize: '0.62rem', fontWeight: 700 },
                                                    }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={`${selectedDayConflictCount} conflicts`}
                                                    sx={{
                                                        bgcolor: 'rgba(227,61,79,0.12)',
                                                        color: '#f0b6be',
                                                        '& .MuiChip-label': { fontSize: '0.62rem', fontWeight: 700 },
                                                    }}
                                                />
                                            </Stack>
                                        </Box>

                                        <Box
                                            sx={{
                                                p: 1.1,
                                                borderRadius: appRadii.card,
                                                border: `1px solid ${chatColors.border}`,
                                                bgcolor: chatColors.panelAltBg,
                                            }}
                                        >
                                            <Stack spacing={1.1}>
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    spacing={0.8}
                                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                                    justifyContent="space-between"
                                                >
                                                    <Box>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 700 }}>
                                                            Schedule from calendar
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.7rem', mt: 0.3 }}>
                                                            Build a meeting for this date without leaving the calendar.
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        size="small"
                                                        onClick={alignDraftToSelectedDate}
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        Use selected date
                                                    </Button>
                                                </Stack>

                                                <TextField
                                                    select
                                                    label="Visibility"
                                                    value={meetingVisibility}
                                                    onChange={(event) => setMeetingVisibility(event.target.value as MeetingVisibility)}
                                                    SelectProps={{ MenuProps: meetingsSelectMenuProps }}
                                                    fullWidth
                                                    size="small"
                                                    sx={meetingsInputSx}
                                                >
                                                    <MenuItem value="channel">Channel-specific</MenuItem>
                                                    <MenuItem value="public">External guests via link</MenuItem>
                                                </TextField>

                                                {meetingVisibility === 'channel' ? (
                                                    <TextField
                                                        select
                                                        label="Channel"
                                                        value={selectedChannelId}
                                                        onChange={(event) => setSelectedChannelId(event.target.value)}
                                                        SelectProps={{ MenuProps: meetingsSelectMenuProps }}
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
                                                ) : null}

                                                <TextField
                                                    label="Meeting name"
                                                    value={meetingTitle}
                                                    onChange={(event) => setMeetingTitle(event.target.value)}
                                                    placeholder="Client review"
                                                    fullWidth
                                                    size="small"
                                                    sx={meetingsInputSx}
                                                />

                                                <TextField
                                                    label="Description"
                                                    value={meetingDescription}
                                                    onChange={(event) => setMeetingDescription(event.target.value)}
                                                    placeholder="Agenda, owner, and expected outcome"
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

                                                <Button
                                                    onClick={() => void handleCreateMeeting()}
                                                    disabled={isCreating}
                                                    sx={meetingsPrimaryButtonSx}
                                                >
                                                    {isCreating ? 'Scheduling...' : 'Create meeting'}
                                                </Button>
                                            </Stack>
                                        </Box>

                                        {meetingsInSelectedDay.length === 0 ? (
                                            <Box
                                                sx={{
                                                    p: 1.3,
                                                    borderRadius: appRadii.card,
                                                    border: `1px dashed ${chatColors.borderStrong}`,
                                                    bgcolor: chatColors.panelAltBg,
                                                }}
                                            >
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.78rem', fontWeight: 700 }}>
                                                    Empty date
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.72rem', mt: 0.45 }}>
                                                    Schedule something new here, or drag a scheduled meeting onto this date from the month grid.
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Stack spacing={0.9}>
                                                {meetingsInSelectedDay.map((meeting) => (
                                                    <Stack key={String(meeting.id)} spacing={0.75}>
                                                        {renderMeetingCard(meeting)}
                                                        {canManageMeeting(meeting) ? (
                                                            <Stack
                                                                direction={{ xs: 'column', sm: 'row' }}
                                                                spacing={0.7}
                                                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                                                justifyContent="space-between"
                                                                sx={{ px: 0.2, pb: 0.2 }}
                                                            >
                                                                <Stack direction="row" spacing={0.7}>
                                                                    <Button
                                                                        size="small"
                                                                        onClick={() => beginEditMeeting(meeting)}
                                                                        sx={meetingsSecondaryButtonSx}
                                                                    >
                                                                        Edit meeting
                                                                    </Button>
                                                                    <Button
                                                                        size="small"
                                                                        onClick={() => void handleCancelMeeting(meeting)}
                                                                        disabled={cancellingMeetingId === meeting.id}
                                                                        sx={{
                                                                            ...meetingsSecondaryButtonSx,
                                                                            color: '#f2b7c0',
                                                                            border: '1px solid rgba(227,61,79,0.22)',
                                                                            bgcolor: 'rgba(227,61,79,0.08)',
                                                                        }}
                                                                    >
                                                                        {cancellingMeetingId === meeting.id ? 'Cancelling...' : 'Cancel'}
                                                                    </Button>
                                                                </Stack>
                                                                <Typography sx={{ color: '#6f7887', fontSize: '0.66rem' }}>
                                                                    Organizer controls stay date-scoped here. Drag between days for quick moves.
                                                                </Typography>
                                                            </Stack>
                                                        ) : null}

                                                        {editingMeetingId === meeting.id ? (
                                                            <Box
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: appRadii.card,
                                                                    border: '1px solid rgba(114,138,255,0.18)',
                                                                    bgcolor: chatColors.panelAltBg,
                                                                }}
                                                            >
                                                                <Stack spacing={0.9}>
                                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.74rem', fontWeight: 700 }}>
                                                                        Update {meeting.title}
                                                                    </Typography>
                                                                    <TextField
                                                                        label="Meeting name"
                                                                        value={editingDraft?.title || ''}
                                                                        onChange={(event) =>
                                                                            setEditingDraft((current) =>
                                                                                current ? { ...current, title: event.target.value } : current
                                                                            )
                                                                        }
                                                                        fullWidth
                                                                        size="small"
                                                                        sx={meetingsInputSx}
                                                                    />
                                                                    <TextField
                                                                        label="Description"
                                                                        value={editingDraft?.description || ''}
                                                                        onChange={(event) =>
                                                                            setEditingDraft((current) =>
                                                                                current ? { ...current, description: event.target.value } : current
                                                                            )
                                                                        }
                                                                        fullWidth
                                                                        multiline
                                                                        minRows={2}
                                                                        size="small"
                                                                        sx={meetingsInputSx}
                                                                    />
                                                                    <TextField
                                                                        select
                                                                        label="Visibility"
                                                                        value={editingDraft?.visibility || 'channel'}
                                                                        onChange={(event) =>
                                                                            setEditingDraft((current) =>
                                                                                current
                                                                                    ? {
                                                                                          ...current,
                                                                                          visibility: event.target.value as MeetingVisibility,
                                                                                          channelId:
                                                                                              event.target.value === 'public'
                                                                                                  ? ''
                                                                                                  : current.channelId,
                                                                                      }
                                                                                    : current
                                                                            )
                                                                        }
                                                                        SelectProps={{ MenuProps: meetingsSelectMenuProps }}
                                                                        fullWidth
                                                                        size="small"
                                                                        sx={meetingsInputSx}
                                                                    >
                                                                        <MenuItem value="channel">Channel-specific</MenuItem>
                                                                        <MenuItem value="public">External guests via link</MenuItem>
                                                                    </TextField>
                                                                    {editingDraft?.visibility === 'channel' ? (
                                                                        <TextField
                                                                            select
                                                                            label="Channel"
                                                                            value={editingDraft.channelId}
                                                                            onChange={(event) =>
                                                                                setEditingDraft((current) =>
                                                                                    current ? { ...current, channelId: event.target.value } : current
                                                                                )
                                                                            }
                                                                            SelectProps={{ MenuProps: meetingsSelectMenuProps }}
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
                                                                    ) : null}
                                                                    <TextField
                                                                        type="datetime-local"
                                                                        value={editingDraft?.scheduledFor || ''}
                                                                        onChange={(event) =>
                                                                            setEditingDraft((current) =>
                                                                                current ? { ...current, scheduledFor: event.target.value } : current
                                                                            )
                                                                        }
                                                                        fullWidth
                                                                        size="small"
                                                                        InputLabelProps={{ shrink: true }}
                                                                        sx={meetingsInputSx}
                                                                    />
                                                                    <Stack direction="row" spacing={0.7}>
                                                                        <Button
                                                                            size="small"
                                                                            onClick={() => void handleUpdateMeeting(meeting)}
                                                                            disabled={updatingMeetingId === meeting.id}
                                                                            sx={meetingsPrimaryButtonSx}
                                                                        >
                                                                            {updatingMeetingId === meeting.id ? 'Saving...' : 'Save'}
                                                                        </Button>
                                                                        <Button
                                                                            size="small"
                                                                            onClick={() => {
                                                                                setEditingMeetingId(null);
                                                                                setEditingDraft(null);
                                                                            }}
                                                                            sx={meetingsSecondaryButtonSx}
                                                                        >
                                                                            Close
                                                                        </Button>
                                                                    </Stack>
                                                                </Stack>
                                                            </Box>
                                                        ) : null}
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}

                    {calendarView === 'week' && (
                        <MeetingsPanel
                            title="Week timeline"
                            description="A compressed seven-day view for balancing the next few days while keeping drag-to-reschedule active."
                        >
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(7, minmax(0, 1fr))' }, gap: 1 }}>
                                {weekDays.map((day) => {
                                    const key = dateKey(day);
                                    const rows = meetingsByDayKey.get(key) || [];
                                    return (
                                        <Box
                                            key={key}
                                            onDragOver={(event) => {
                                                if (draggingMeetingId != null) event.preventDefault();
                                            }}
                                            onDrop={() => {
                                                if (draggingMeetingId == null) return;
                                                void handleDropReschedule(draggingMeetingId, key);
                                            }}
                                            sx={{
                                                border: '1px solid #171717',
                                                borderRadius: appRadii.card,
                                                p: 0.8,
                                                minHeight: 190,
                                                bgcolor: 'rgba(255,255,255,0.02)',
                                            }}
                                        >
                                            <Typography sx={{ color: '#e4e9f4', fontSize: '0.68rem', fontWeight: 700, mb: 0.65 }}>
                                                {day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </Typography>
                                            <Stack spacing={0.65}>
                                                {rows.length === 0 ? (
                                                    <Typography sx={{ color: '#6d7583', fontSize: '0.66rem' }}>No meetings</Typography>
                                                ) : (
                                                    rows.map((meeting) => renderMeetingCard(meeting, true))
                                                )}
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </MeetingsPanel>
                    )}

                    {calendarView === 'day' && (
                        <MeetingsPanel
                            title="Day view"
                            description="A focused list for one date. This uses the same selected date as the month grid."
                        >
                            <Typography sx={{ color: '#d4d9e5', fontSize: '0.82rem', fontWeight: 700, mb: 1 }}>
                                {selectedDate.toLocaleDateString([], {
                                    weekday: 'long',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Typography>
                            {meetingsInSelectedDay.length === 0 ? (
                                <Typography sx={{ color: '#6d7583', fontSize: '0.78rem' }}>No meetings for this day.</Typography>
                            ) : (
                                <Stack spacing={0.85}>
                                    {meetingsInSelectedDay.map((meeting) => renderMeetingCard(meeting))}
                                </Stack>
                            )}
                        </MeetingsPanel>
                    )}

                    {calendarView === 'agenda' && (
                        <MeetingsPanel
                            title="Agenda"
                            description="A full chronological list across all visible meetings."
                        >
                            {meetingsForUser.length === 0 ? (
                                <Typography sx={{ color: '#6d7583', fontSize: '0.78rem' }}>No meetings yet.</Typography>
                            ) : (
                                <Stack spacing={0.85}>
                                    {meetingsForUser.map((meeting) => renderMeetingCard(meeting))}
                                </Stack>
                            )}
                        </MeetingsPanel>
                    )}
            </MeetingsPageShell>
        </DashboardLayout>
    );
}
