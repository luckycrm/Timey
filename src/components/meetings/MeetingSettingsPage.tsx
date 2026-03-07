import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { tables, reducers } from '../../module_bindings';
import { sendMeetingEmail } from '../../server/meetings';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import type {
    ChatChannel as DbChatChannel,
    ChatChannelMember as DbChatChannelMember,
    ChatScheduledMeeting as DbChatScheduledMeeting,
    MeetingAvailabilityRule as DbMeetingAvailabilityRule,
    MeetingBooking as DbMeetingBooking,
    MeetingEventType as DbMeetingEventType,
    MeetingFollowupTemplate as DbMeetingFollowupTemplate,
    MeetingReminderTemplate as DbMeetingReminderTemplate,
    MeetingReminderDelivery as DbMeetingReminderDelivery,
    MeetingPublicProfile as DbMeetingPublicProfile,
    MeetingRecordingPolicy as DbMeetingRecordingPolicy,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';
import { MeetingsSidebar } from './MeetingsSidebar';
import {
    MeetingsPageShell,
    meetingsPanelSx,
    meetingsInputSx,
    meetingsPrimaryButtonSx,
    meetingsSecondaryButtonSx,
} from './MeetingsUI';

const FULL_WEEK_OPTIONS = [
    { value: 0n, label: 'Sunday', helper: 'Usually closed or reduced hours' },
    { value: 1n, label: 'Monday', helper: 'Start of the work week' },
    { value: 2n, label: 'Tuesday', helper: 'Regular office hours' },
    { value: 3n, label: 'Wednesday', helper: 'Regular office hours' },
    { value: 4n, label: 'Thursday', helper: 'Regular office hours' },
    { value: 5n, label: 'Friday', helper: 'Wrap-up and reviews' },
    { value: 6n, label: 'Saturday', helper: 'Usually closed or reduced hours' },
] as const;

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30;
    const hour24 = Math.floor(minutes / 60);
    const minutePart = minutes % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return {
        value: String(minutes),
        label: `${hour12}:${String(minutePart).padStart(2, '0')} ${period}`,
    };
});

type WeeklyAvailabilityDay = {
    weekday: number;
    enabled: boolean;
    startMinute: string;
    endMinute: string;
};

const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailabilityDay[] = [
    { weekday: 0, enabled: false, startMinute: '540', endMinute: '1020' },
    { weekday: 1, enabled: true, startMinute: '540', endMinute: '1020' },
    { weekday: 2, enabled: true, startMinute: '540', endMinute: '1020' },
    { weekday: 3, enabled: true, startMinute: '540', endMinute: '1020' },
    { weekday: 4, enabled: true, startMinute: '540', endMinute: '1020' },
    { weekday: 5, enabled: true, startMinute: '540', endMinute: '1020' },
    { weekday: 6, enabled: false, startMinute: '540', endMinute: '1020' },
];

function formatBookingTimestamp(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatReminderTiming(triggerAt: bigint, nowMs: number): string {
    const diffMin = Math.round((Number(triggerAt) - nowMs) / 60000);
    if (diffMin <= 0) return 'due now';
    if (diffMin === 1) return 'in 1 min';
    if (diffMin < 60) return `in ${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (mins === 0) return `in ${hours}h`;
    return `in ${hours}h ${mins}m`;
}

function slugifyValue(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function buildWeeklyAvailabilityFromRules(rules: DbMeetingAvailabilityRule[]): WeeklyAvailabilityDay[] {
    const latestByDay = new Map<number, DbMeetingAvailabilityRule>();
    const sorted = [...rules].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));

    for (const rule of sorted) {
        const weekday = Number(rule.weekday);
        if (!latestByDay.has(weekday)) {
            latestByDay.set(weekday, rule);
        }
    }

    return DEFAULT_WEEKLY_AVAILABILITY.map((defaultDay) => {
        const existing = latestByDay.get(defaultDay.weekday);
        if (!existing) return defaultDay;
        return {
            weekday: defaultDay.weekday,
            enabled: existing.isEnabled,
            startMinute: String(existing.startMinute),
            endMinute: String(existing.endMinute),
        };
    });
}

function formatOfficeHoursSummary(days: WeeklyAvailabilityDay[]): string {
    const openDays = days.filter((day) => day.enabled);
    if (openDays.length === 0) return 'All days are closed right now.';
    if (openDays.length === 7) return 'Open every day using the times below.';
    const weekdayOpen = openDays.filter((day) => day.weekday >= 1 && day.weekday <= 5).length;
    const weekendOpen = openDays.filter((day) => day.weekday === 0 || day.weekday === 6).length;
    if (weekdayOpen === 5 && weekendOpen === 0) return 'Open Monday to Friday. Weekends are closed.';
    return `Open on ${openDays.length} days each week.`;
}

const settingsSubpanelSx = {
    p: 1.25,
    borderRadius: appRadii.card,
    bgcolor: 'transparent',
    border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
};

const settingsLabelSx = {
    color: chatColors.textPrimary,
    fontSize: '0.96rem',
    fontWeight: 800,
};

const settingsHintSx = {
    color: chatColors.textSecondary,
    fontSize: '0.73rem',
    lineHeight: 1.55,
};

function SettingsSection({
    icon,
    title,
    description,
    action,
    children,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Paper
            sx={{
                ...meetingsPanelSx,
                p: { xs: 1.8, md: 2.1 },
                borderRadius: appRadii.panel,
                boxShadow: 'none',
            }}
        >
            <Stack spacing={1.4}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                >
                    <Stack spacing={0.45}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                            <Box sx={{ color: chatColors.textSecondary, display: 'grid', placeItems: 'center' }}>{icon}</Box>
                            <Typography sx={settingsLabelSx}>{title}</Typography>
                        </Stack>
                        <Typography sx={settingsHintSx}>{description}</Typography>
                    </Stack>
                    {action}
                </Stack>
                <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />
                {children}
            </Stack>
        </Paper>
    );
}

function SettingsSubsection({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Box sx={settingsSubpanelSx}>
            <Stack spacing={1}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={0.8}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Stack spacing={0.3}>
                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                            {title}
                        </Typography>
                        {description ? <Typography sx={settingsHintSx}>{description}</Typography> : null}
                    </Stack>
                    {action}
                </Stack>
                <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />
                {children}
            </Stack>
        </Box>
    );
}

type SettingsStepId = 'profile' | 'event-types' | 'defaults' | 'automation';

function PreviewPanel({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Box
            sx={{
                p: 1.25,
                borderRadius: appRadii.card,
                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                bgcolor: alpha(chatColors.textPrimary, 0.02),
            }}
        >
            <Stack spacing={1}>
                <Box>
                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                        {title}
                    </Typography>
                    <Typography sx={settingsHintSx}>{description}</Typography>
                </Box>
                <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />
                {children}
            </Stack>
        </Box>
    );
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

export function MeetingSettingsPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership, membershipUnavailable } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const navigate = useNavigate();

    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allOrganizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allProfiles] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_public_profile : 'skip');
    const [allEventTypes] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_event_type : 'skip');
    const [allAvailabilityRules] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_availability_rule : 'skip');
    const [allRecordingPolicies] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_recording_policy : 'skip');
    const [allFollowupTemplates] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_followup_template : 'skip');
    const [allReminderTemplates] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_reminder_template : 'skip');
    const [allReminderDeliveries] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_reminder_delivery : 'skip');
    const [allBookings] = useSpacetimeDBQuery(isAuthenticated ? tables.meeting_booking : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');

    const upsertPublicProfileReducer = useReducer(reducers.upsertMeetingPublicProfile);
    const createEventTypeReducer = useReducer(reducers.createMeetingEventType);
    const updateEventTypeReducer = useReducer(reducers.updateMeetingEventType);
    const setAvailabilityRulesReducer = useReducer(reducers.setMeetingAvailabilityRules);
    const setRecordingPolicyReducer = useReducer(reducers.setMeetingRecordingPolicy);
    const createFollowupTemplateReducer = useReducer(reducers.createMeetingFollowupTemplate);
    const setMeetingReminderTemplateReducer = useReducer(reducers.setMeetingReminderTemplate);
    const queueMeetingReminderDeliveriesReducer = useReducer(reducers.queueMeetingReminderDeliveries);
    const markMeetingReminderDeliveryStatusReducer = useReducer(reducers.markMeetingReminderDeliveryStatus);

    const users = (allUsers || []) as DbUser[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const channels = (allChannels || []) as DbChatChannel[];
    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const availabilityRules = (allAvailabilityRules || []) as DbMeetingAvailabilityRule[];
    const recordingPolicies = (allRecordingPolicies || []) as DbMeetingRecordingPolicy[];
    const followupTemplates = (allFollowupTemplates || []) as DbMeetingFollowupTemplate[];
    const reminderTemplates = (allReminderTemplates || []) as DbMeetingReminderTemplate[];
    const reminderDeliveries = (allReminderDeliveries || []) as DbMeetingReminderDelivery[];
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

    const orgRecordingPolicy = useMemo(() => {
        if (orgId == null) return null;
        return recordingPolicies.find((policy) => policy.orgId === orgId) || null;
    }, [orgId, recordingPolicies]);

    const orgTemplates = useMemo(() => {
        if (orgId == null) return [];
        return followupTemplates
            .filter((template) => template.orgId === orgId)
            .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    }, [followupTemplates, orgId]);

    const orgReminderTemplates = useMemo(() => {
        if (orgId == null) return [];
        return reminderTemplates
            .filter((template) => template.orgId === orgId)
            .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    }, [orgId, reminderTemplates]);

    const orgPendingReminderDeliveries = useMemo(() => {
        if (orgId == null) return [];
        return reminderDeliveries
            .filter((row) => row.orgId === orgId && row.status === 'pending')
            .sort((a, b) => Number(a.triggerAt) - Number(b.triggerAt))
            .slice(0, 40);
    }, [orgId, reminderDeliveries]);

    const [reminderNowMs, setReminderNowMs] = useState(() => Date.now());

    const dueReminderDeliveries = useMemo(() => {
        return orgPendingReminderDeliveries.filter((row) => Number(row.triggerAt) <= reminderNowMs + 60_000);
    }, [orgPendingReminderDeliveries, reminderNowMs]);

    const recentReminderFailures = useMemo(() => {
        if (orgId == null) return [];
        return reminderDeliveries
            .filter((row) => row.orgId === orgId && row.status === 'failed')
            .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
            .slice(0, 6);
    }, [orgId, reminderDeliveries]);

    const [handle, setHandle] = useState('');
    const [headline, setHeadline] = useState('');
    const [profileTimezone, setProfileTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const [bookingEnabled, setBookingEnabled] = useState(true);

    const [eventSlug, setEventSlug] = useState('office-hours');
    const [eventTitle, setEventTitle] = useState('Office hours');
    const [eventDescription, setEventDescription] = useState('A short office meeting for updates, planning, or questions.');
    const [eventDurationMin, setEventDurationMin] = useState('30');
    const [eventVisibility, setEventVisibility] = useState<'public' | 'channel'>('public');
    const [eventDefaultChannelId, setEventDefaultChannelId] = useState('');
    const [eventActive, setEventActive] = useState(true);
    const [eventRequireApproval, setEventRequireApproval] = useState(false);
    const [eventMaxDays, setEventMaxDays] = useState('60');
    const [eventMinNotice, setEventMinNotice] = useState('30');
    const [eventBufferBefore, setEventBufferBefore] = useState('5');
    const [eventBufferAfter, setEventBufferAfter] = useState('5');
    const [showAdvancedEventSettings, setShowAdvancedEventSettings] = useState(false);
    const [eventSlugTouched, setEventSlugTouched] = useState(false);

    const [availabilityEventTypeId, setAvailabilityEventTypeId] = useState('');
    const [availabilityTimezone, setAvailabilityTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailabilityDay[]>(DEFAULT_WEEKLY_AVAILABILITY);

    const [recordingMode, setRecordingMode] = useState<'off' | 'optional' | 'required'>('optional');
    const [recordingAuto, setRecordingAuto] = useState(false);
    const [recordingRetention, setRecordingRetention] = useState('30');
    const [recordingDescription, setRecordingDescription] = useState('Default recording policy');

    const [templateTitle, setTemplateTitle] = useState('Post-meeting checklist');
    const [templateItems, setTemplateItems] = useState<string[]>([
        'Share meeting notes with everyone involved',
        'Assign the next steps and owners',
        'Schedule a follow-up if more work is needed',
    ]);
    const [templateDefault, setTemplateDefault] = useState(true);
    const [reminderName, setReminderName] = useState('Standard reminders');
    const [reminderOffsets, setReminderOffsets] = useState('[1440,60,10]');
    const [reminderScope, setReminderScope] = useState<'all' | 'public' | 'channel'>('all');
    const [reminderDefault, setReminderDefault] = useState(true);
    const [reminderActive, setReminderActive] = useState(true);
    const [reminderQueueHorizonMin, setReminderQueueHorizonMin] = useState('15');
    const [isQueueingReminders, setIsQueueingReminders] = useState(false);
    const [isDispatchingDueReminders, setIsDispatchingDueReminders] = useState(false);
    const [dispatchingDeliveryId, setDispatchingDeliveryId] = useState<bigint | null>(null);
    const [activeStep, setActiveStep] = useState<SettingsStepId>('profile');

    useEffect(() => {
        if (myProfile) {
            setHandle(myProfile.handle);
            setHeadline(myProfile.headline);
            setProfileTimezone((prev) => myProfile.timezone || prev);
            setBookingEnabled(myProfile.bookingEnabled);
        }
    }, [myProfile]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setReminderNowMs(Date.now());
        }, 30000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!eventSlugTouched) {
            setEventSlug(slugifyValue(eventTitle) || 'meeting');
        }
    }, [eventTitle, eventSlugTouched]);

    useEffect(() => {
        if (!availabilityEventTypeId && myEventTypes.length > 0) {
            setAvailabilityEventTypeId(String(myEventTypes[0].id));
        }
    }, [availabilityEventTypeId, myEventTypes]);

    const applyDefaultsFromPolicy = () => {
        if (!orgRecordingPolicy) return;
        setRecordingMode(orgRecordingPolicy.mode as 'off' | 'optional' | 'required');
        setRecordingAuto(orgRecordingPolicy.autoRecord);
        setRecordingRetention(String(orgRecordingPolicy.retentionDays));
        setRecordingDescription(orgRecordingPolicy.description);
    };

    const availabilityRulesForSelected = useMemo(() => {
        const selected = availabilityEventTypeId ? BigInt(availabilityEventTypeId) : null;
        if (!selected || !currentUser) return [];
        return availabilityRules.filter((rule) => rule.eventTypeId === selected && rule.userId === currentUser.id);
    }, [availabilityEventTypeId, availabilityRules, currentUser]);

    useEffect(() => {
        setWeeklyAvailability(buildWeeklyAvailabilityFromRules(availabilityRulesForSelected));
    }, [availabilityRulesForSelected]);

    const handleSaveProfile = async () => {
        if (!currentUser || orgId == null) return;
        try {
            await upsertPublicProfileReducer({
                orgId,
                handle: handle.trim().toLowerCase(),
                timezone: profileTimezone.trim(),
                headline: headline.trim(),
                bookingEnabled,
            });
            toast.success('Booking page profile saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save profile');
        }
    };

    const handleCreateEventType = async () => {
        if (!currentUser || orgId == null) return;
        try {
            await createEventTypeReducer({
                orgId,
                slug: eventSlug.trim().toLowerCase(),
                title: eventTitle.trim(),
                description: eventDescription.trim(),
                durationMin: BigInt(Number(eventDurationMin || '0')),
                visibility: eventVisibility,
                defaultChannelId:
                    eventVisibility === 'channel' && eventDefaultChannelId
                        ? BigInt(eventDefaultChannelId)
                        : NONE_U64,
                requireApproval: eventRequireApproval,
                isActive: eventActive,
                maxDaysInAdvance: BigInt(Number(eventMaxDays || '0')),
                minNoticeMin: BigInt(Number(eventMinNotice || '0')),
                bufferBeforeMin: BigInt(Number(eventBufferBefore || '0')),
                bufferAfterMin: BigInt(Number(eventBufferAfter || '0')),
            });
            toast.success('Event type created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create event type');
        }
    };

    const handleToggleEventType = async (eventType: DbMeetingEventType) => {
        try {
            await updateEventTypeReducer({
                eventTypeId: eventType.id,
                title: eventType.title,
                description: eventType.description,
                durationMin: eventType.durationMin,
                visibility: eventType.visibility,
                defaultChannelId: eventType.defaultChannelId,
                requireApproval: eventType.requireApproval,
                isActive: !eventType.isActive,
                maxDaysInAdvance: eventType.maxDaysInAdvance,
                minNoticeMin: eventType.minNoticeMin,
                bufferBeforeMin: eventType.bufferBeforeMin,
                bufferAfterMin: eventType.bufferAfterMin,
            });
            toast.success('Event type updated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update event type');
        }
    };

    const handleSetAvailability = async () => {
        if (!availabilityEventTypeId) {
            toast.message('Choose the booking type you want to edit first');
            return;
        }

        const invalidDay = weeklyAvailability.find(
            (day) => Number(day.startMinute) >= Number(day.endMinute)
        );
        if (invalidDay) {
            const dayLabel = FULL_WEEK_OPTIONS.find((option) => option.value === BigInt(invalidDay.weekday))?.label || 'Selected day';
            toast.error(`${dayLabel} needs a closing time later than the opening time`);
            return;
        }

        try {
            const rulesPayload = weeklyAvailability.map((day) => ({
                weekday: day.weekday,
                start_minute: Number(day.startMinute || '540'),
                end_minute: Number(day.endMinute || '1020'),
                is_enabled: day.enabled,
            }));
            await setAvailabilityRulesReducer({
                eventTypeId: BigInt(availabilityEventTypeId),
                timezone: availabilityTimezone.trim(),
                rulesJson: JSON.stringify(rulesPayload),
            });
            toast.success('Office hours updated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update availability');
        }
    };

    const handleSetRecordingPolicy = async () => {
        if (orgId == null) return;
        try {
            await setRecordingPolicyReducer({
                orgId,
                mode: recordingMode,
                autoRecord: recordingAuto,
                retentionDays: BigInt(Number(recordingRetention || '0')),
                description: recordingDescription.trim(),
            });
            toast.success('Recording policy saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save recording policy');
        }
    };

    const handleCreateTemplate = async () => {
        if (orgId == null) return;
        const cleanedItems = templateItems.map((item) => item.trim()).filter(Boolean);
        if (cleanedItems.length === 0) {
            toast.error('Add at least one follow-up task');
            return;
        }

        try {
            await createFollowupTemplateReducer({
                orgId,
                title: templateTitle.trim(),
                itemsJson: JSON.stringify(cleanedItems),
                isDefault: templateDefault,
            });
            toast.success('Follow-up template created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create template');
        }
    };

    const handleSaveReminderTemplate = async () => {
        if (orgId == null) return;
        try {
            JSON.parse(reminderOffsets);
        } catch {
            toast.error('Reminder offsets must be a valid JSON array');
            return;
        }

        try {
            await setMeetingReminderTemplateReducer({
                orgId,
                name: reminderName.trim(),
                offsetsJson: reminderOffsets.trim(),
                channelScope: reminderScope,
                isDefault: reminderDefault,
                isActive: reminderActive,
            });
            toast.success('Reminder template saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save reminder template');
        }
    };

    const handleQueueReminderDeliveries = async () => {
        if (orgId == null) return;
        const horizon = Number(reminderQueueHorizonMin || '0');
        if (!Number.isFinite(horizon) || horizon < 1 || horizon > 1440) {
            toast.error('Horizon must be between 1 and 1440 minutes');
            return;
        }

        setIsQueueingReminders(true);
        try {
            await queueMeetingReminderDeliveriesReducer({
                orgId,
                horizonMin: BigInt(Math.floor(horizon)),
            });
            toast.success('Reminder queue updated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not queue reminders');
        } finally {
            setIsQueueingReminders(false);
        }
    };

    const dispatchReminderDelivery = async (delivery: DbMeetingReminderDelivery) => {
        const booking = bookings.find((row) => row.id === delivery.bookingId);
        const template = reminderTemplates.find((row) => row.id === delivery.templateId);
        const eventType = booking ? eventTypes.find((row) => row.id === booking.eventTypeId) : null;

        if (!booking) {
            throw new Error('Booking not found for this reminder delivery');
        }

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
                notes: template
                    ? `Reminder from template: ${template.name}${booking.notes ? `\n\n${booking.notes}` : ''}`
                    : booking.notes,
                manageUrl: `${window.location.origin}/booking/${booking.bookingToken}`,
            } as any,
        });
        if (!emailResult?.success) {
            throw new Error(emailResult?.error || 'Could not send reminder email');
        }
    };

    const handleDispatchReminderDelivery = async (delivery: DbMeetingReminderDelivery) => {
        setDispatchingDeliveryId(delivery.id);
        try {
            await dispatchReminderDelivery(delivery);
            await markMeetingReminderDeliveryStatusReducer({
                deliveryId: delivery.id,
                status: 'sent',
                error: '',
            });
            toast.success('Reminder sent');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not dispatch reminder';
            try {
                await markMeetingReminderDeliveryStatusReducer({
                    deliveryId: delivery.id,
                    status: 'failed',
                    error: message,
                });
            } catch (markError) {
                console.warn('Could not mark reminder delivery as failed:', markError);
            }
            toast.error(message);
        } finally {
            setDispatchingDeliveryId(null);
        }
    };

    const handleDispatchDueReminders = async () => {
        if (dueReminderDeliveries.length === 0) {
            toast.message('No reminders are due right now');
            return;
        }

        setIsDispatchingDueReminders(true);
        let sentCount = 0;
        let failedCount = 0;

        try {
            for (const delivery of dueReminderDeliveries.slice(0, 20)) {
                setDispatchingDeliveryId(delivery.id);
                try {
                    await dispatchReminderDelivery(delivery);
                    await markMeetingReminderDeliveryStatusReducer({
                        deliveryId: delivery.id,
                        status: 'sent',
                        error: '',
                    });
                    sentCount += 1;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Could not dispatch reminder';
                    failedCount += 1;
                    try {
                        await markMeetingReminderDeliveryStatusReducer({
                            deliveryId: delivery.id,
                            status: 'failed',
                            error: message,
                        });
                    } catch (markError) {
                        console.warn('Could not mark reminder delivery as failed:', markError);
                    }
                }
            }

            if (sentCount > 0 && failedCount === 0) {
                toast.success(`Sent ${sentCount} due reminder${sentCount === 1 ? '' : 's'}`);
            } else {
                toast.message(`Reminder dispatch finished: ${sentCount} sent, ${failedCount} failed`);
            }
        } finally {
            setDispatchingDeliveryId(null);
            setIsDispatchingDueReminders(false);
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
                            This settings screen depends on the live workspace identity. Refresh after the SpacetimeDB session reconnects instead of being redirected.
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
        (handle.trim() || myProfile?.handle)
            ? `/u/${handle.trim() || myProfile?.handle || ''}`
            : null;

    const setupSteps: Array<{
        id: SettingsStepId;
        title: string;
        helper: string;
        status: string;
    }> = [
        {
            id: 'profile',
            title: 'Step 1: Booking page',
            helper: 'Create the public page people use to request time.',
            status: bookingEnabled ? 'Ready' : 'Draft',
        },
        {
            id: 'event-types',
            title: 'Step 2: Booking types',
            helper: 'Create what people can actually book.',
            status: `${myEventTypes.filter((eventType) => eventType.isActive).length} live`,
        },
        {
            id: 'defaults',
            title: 'Step 3: Availability and policy',
            helper: 'Set working hours, recordings, and follow-up defaults.',
            status: `${availabilityRulesForSelected.length} rules`,
        },
        {
            id: 'automation',
            title: 'Step 4: Reminders and follow-up',
            helper: 'Configure reminders and review activity.',
            status: `${orgPendingReminderDeliveries.length} queued`,
        },
    ];

    const activeStepIndex = setupSteps.findIndex((step) => step.id === activeStep);
    const canGoBack = activeStepIndex > 0;
    const canGoNext = activeStepIndex < setupSteps.length - 1;

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
                icon={<SettingsRoundedIcon sx={{ fontSize: 20 }} />}
                title="Meeting Settings"
                description="A simple setup flow for your booking page, meeting types, office hours, and reminders."
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
            >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' }, gap: 1.6, alignItems: 'start' }}>
                    <Paper
                        sx={{
                            ...meetingsPanelSx,
                            p: 1.2,
                            borderRadius: appRadii.panel,
                            position: { lg: 'sticky' },
                            top: { lg: 24 },
                            boxShadow: 'none',
                        }}
                    >
                        <Stack spacing={0.8}>
                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 800 }}>
                                Setup steps
                            </Typography>
                            {setupSteps.map((step, index) => {
                                const active = step.id === activeStep;
                                return (
                                    <Button
                                        key={step.id}
                                        onClick={() => setActiveStep(step.id)}
                                        sx={{
                                            textTransform: 'none',
                                            justifyContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            p: 1.05,
                                            borderRadius: appRadii.control,
                                            border: `1px solid ${active ? 'rgba(114,138,255,0.32)' : alpha(chatColors.textPrimary, 0.07)}`,
                                            bgcolor: active ? 'rgba(114,138,255,0.1)' : 'transparent',
                                            color: chatColors.textPrimary,
                                        }}
                                    >
                                        <Stack spacing={0.25} sx={{ textAlign: 'left' }}>
                                            <Typography sx={{ color: active ? '#c7d3ff' : chatColors.textSecondary, fontSize: '0.64rem', fontWeight: 800 }}>
                                                Step {index + 1}
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.76rem', fontWeight: 700 }}>
                                                {step.title.replace(/^Step \d+:\s*/, '')}
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.66rem', lineHeight: 1.45 }}>
                                                {step.helper}
                                            </Typography>
                                            <Typography sx={{ color: active ? '#c7d3ff' : chatColors.textMuted, fontSize: '0.62rem', fontWeight: 700 }}>
                                                {step.status}
                                            </Typography>
                                        </Stack>
                                    </Button>
                                );
                            })}
                        </Stack>
                    </Paper>

                    <Stack spacing={1.6}>
                    {activeStep === 'profile' ? (
                        <SettingsSection
                            icon={<LinkRoundedIcon sx={{ fontSize: 16 }} />}
                            title="Step 1. Public booking page"
                            description="Set the public identity and link people outside your organization will use when they want to meet with you."
                            action={
                                publicBookingHref ? (
                                    <Button
                                        component="a"
                                        href={publicBookingHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        size="small"
                                        startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                                        sx={meetingsSecondaryButtonSx}
                                    >
                                        Preview
                                    </Button>
                                ) : null
                            }
                        >
                            <Stack spacing={1.2}>
                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        size="small"
                                        label={bookingEnabled ? 'Accepting bookings' : 'Bookings turned off'}
                                        sx={{
                                            bgcolor: bookingEnabled ? 'rgba(56,200,114,0.16)' : alpha(chatColors.textPrimary, 0.08),
                                            color: bookingEnabled ? '#b7f3cf' : chatColors.textSecondary,
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        label={`/u/${handle.trim().toLowerCase() || 'your-handle'}`}
                                        sx={{ bgcolor: alpha(chatColors.textPrimary, 0.07), color: chatColors.textSecondary }}
                                    />
                                </Stack>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                    <TextField
                                        label="Booking page URL"
                                        value={handle}
                                        onChange={(event) => setHandle(event.target.value)}
                                        placeholder="alex-johnson"
                                        helperText="Used in your public link."
                                        size="small"
                                        sx={meetingsInputSx}
                                    />
                                    <TextField
                                        label="Timezone"
                                        value={profileTimezone}
                                        onChange={(event) => setProfileTimezone(event.target.value)}
                                        helperText="Shown as your default booking timezone."
                                        size="small"
                                        sx={meetingsInputSx}
                                    />
                                </Box>
                                <TextField
                                    label="Intro text"
                                    value={headline}
                                    onChange={(event) => setHeadline(event.target.value)}
                                    placeholder="Book time for office discussions, planning, or approvals"
                                    helperText="Keep this short. It appears near the top of your public page."
                                    size="small"
                                    sx={meetingsInputSx}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={bookingEnabled}
                                            onChange={(event) => setBookingEnabled(event.target.checked)}
                                        />
                                    }
                                    label="Accept new external bookings"
                                    sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.78rem' } }}
                                />
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between">
                                    <Typography sx={settingsHintSx}>
                                        Shareable link: {publicBookingHref || `/u/${handle.trim().toLowerCase() || 'your-handle'}`}
                                    </Typography>
                                    <Button onClick={() => void handleSaveProfile()} sx={meetingsPrimaryButtonSx}>
                                        Save booking page
                                    </Button>
                                </Stack>
                                <PreviewPanel
                                    title="Live preview"
                                    description="This is the basic public booking header visitors will see."
                                >
                                    <Box
                                        sx={{
                                            p: 1.4,
                                            borderRadius: appRadii.card,
                                            border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                            bgcolor: chatColors.panelBg,
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                <Box>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>
                                                        {currentUser.name || currentUser.email || orgName}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.72rem' }}>
                                                        {headline.trim() || 'Book time for office discussions, planning, or approvals'}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    size="small"
                                                    label={bookingEnabled ? 'Open for booking' : 'Hidden'}
                                                    sx={{
                                                        bgcolor: bookingEnabled ? 'rgba(56,200,114,0.16)' : alpha(chatColors.textPrimary, 0.08),
                                                        color: bookingEnabled ? '#b7f3cf' : chatColors.textSecondary,
                                                    }}
                                                />
                                            </Stack>
                                            <Stack spacing={0.35}>
                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Public URL
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.74rem', fontWeight: 700 }}>
                                                    {publicBookingHref || `/u/${handle.trim().toLowerCase() || 'your-handle'}`}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                                <Chip size="small" label={`Timezone: ${profileTimezone || 'UTC'}`} sx={{ bgcolor: alpha(chatColors.textPrimary, 0.06), color: chatColors.textSecondary }} />
                                                <Chip size="small" label={`${myEventTypes.filter((eventType) => eventType.isActive).length} active types`} sx={{ bgcolor: alpha(chatColors.textPrimary, 0.06), color: chatColors.textSecondary }} />
                                            </Stack>
                                        </Stack>
                                    </Box>
                                </PreviewPanel>
                            </Stack>
                        </SettingsSection>
                    ) : null}

                    {activeStep === 'event-types' ? (
                        <SettingsSection
                            icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />}
                            title="Step 2. Booking types"
                            description="Create the meeting options people can book. Keep it simple first, then open advanced settings only if you need them."
                        >
                            <Stack spacing={1.2}>
                                <SettingsSubsection
                                    title="Create a booking type"
                                    description="For most teams, only the name, length, and audience matter."
                                >
                                    <Stack spacing={1}>
                                        <TextField
                                            label="Booking type name"
                                            value={eventTitle}
                                            onChange={(event) => setEventTitle(event.target.value)}
                                            helperText="Example: Office hours, Manager review, Weekly planning"
                                            size="small"
                                            sx={meetingsInputSx}
                                        />
                                        <TextField
                                            label="Short description"
                                            value={eventDescription}
                                            onChange={(event) => setEventDescription(event.target.value)}
                                            helperText="Explain what this meeting is for in one sentence."
                                            size="small"
                                            sx={meetingsInputSx}
                                        />
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                            <TextField
                                                select
                                                label="Meeting length"
                                                value={eventDurationMin}
                                                onChange={(event) => setEventDurationMin(event.target.value)}
                                                size="small"
                                                sx={meetingsInputSx}
                                            >
                                                <MenuItem value="15">15 minutes</MenuItem>
                                                <MenuItem value="30">30 minutes</MenuItem>
                                                <MenuItem value="45">45 minutes</MenuItem>
                                                <MenuItem value="60">60 minutes</MenuItem>
                                            </TextField>
                                            <TextField
                                                select
                                                label="Who can book this?"
                                                value={eventVisibility}
                                                onChange={(event) => setEventVisibility(event.target.value as 'public' | 'channel')}
                                                size="small"
                                                sx={meetingsInputSx}
                                            >
                                                <MenuItem value="public">External guests</MenuItem>
                                                <MenuItem value="channel">Channel members</MenuItem>
                                            </TextField>
                                        </Box>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                                            <FormControlLabel
                                                control={<Switch checked={eventActive} onChange={(event) => setEventActive(event.target.checked)} />}
                                                label="Make this bookable right away"
                                                sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.74rem' } }}
                                            />
                                            <FormControlLabel
                                                control={<Switch checked={eventRequireApproval} onChange={(event) => setEventRequireApproval(event.target.checked)} />}
                                                label="I want to approve requests before they are confirmed"
                                                sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.74rem' } }}
                                            />
                                        </Stack>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                                            <Button
                                                onClick={() => setShowAdvancedEventSettings((prev) => !prev)}
                                                sx={meetingsSecondaryButtonSx}
                                            >
                                                {showAdvancedEventSettings ? 'Hide advanced options' : 'Show advanced options'}
                                            </Button>
                                            <Button onClick={() => void handleCreateEventType()} sx={meetingsPrimaryButtonSx}>
                                                Create booking type
                                            </Button>
                                        </Stack>

                                        {showAdvancedEventSettings ? (
                                            <Box
                                                sx={{
                                                    p: 1.1,
                                                    borderRadius: appRadii.card,
                                                    border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                    bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                }}
                                            >
                                                <Stack spacing={1}>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.76rem', fontWeight: 700 }}>
                                                        Advanced options
                                                    </Typography>
                                                    <Typography sx={settingsHintSx}>
                                                        Use these only if you need a custom URL, channel default, or extra booking limits.
                                                    </Typography>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                                        <TextField
                                                            label="Custom URL slug"
                                                            value={eventSlug}
                                                            onChange={(event) => {
                                                                setEventSlugTouched(true);
                                                                setEventSlug(slugifyValue(event.target.value));
                                                            }}
                                                            helperText="Example: office-hours"
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        />
                                                        <TextField
                                                            select
                                                            disabled={eventVisibility !== 'channel'}
                                                            label="Default channel"
                                                            value={eventDefaultChannelId}
                                                            onChange={(event) => setEventDefaultChannelId(event.target.value)}
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        >
                                                            {channels
                                                                .filter((channel) => channel.orgId === orgId)
                                                                .map((channel) => (
                                                                    <MenuItem key={String(channel.id)} value={String(channel.id)}>
                                                                        #{channel.name}
                                                                    </MenuItem>
                                                                ))}
                                                        </TextField>
                                                    </Box>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                                        <TextField
                                                            label="Book up to (days)"
                                                            value={eventMaxDays}
                                                            onChange={(event) => setEventMaxDays(event.target.value)}
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        />
                                                        <TextField
                                                            label="Minimum notice (min)"
                                                            value={eventMinNotice}
                                                            onChange={(event) => setEventMinNotice(event.target.value)}
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                                        <TextField
                                                            label="Buffer before (min)"
                                                            value={eventBufferBefore}
                                                            onChange={(event) => setEventBufferBefore(event.target.value)}
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        />
                                                        <TextField
                                                            label="Buffer after (min)"
                                                            value={eventBufferAfter}
                                                            onChange={(event) => setEventBufferAfter(event.target.value)}
                                                            size="small"
                                                            sx={meetingsInputSx}
                                                        />
                                                    </Box>
                                                    <Typography sx={settingsHintSx}>
                                                        Public URL preview: /u/{handle.trim().toLowerCase() || 'your-handle'}/{eventSlug.trim().toLowerCase() || 'event'}
                                                    </Typography>
                                                </Stack>
                                            </Box>
                                        ) : null}
                                    </Stack>
                                </SettingsSubsection>

                                <SettingsSubsection
                                    title="Current event types"
                                    description="Turn booking options on or off without deleting them."
                                >
                                    <Stack spacing={0.8}>
                                        {myEventTypes.length === 0 ? (
                                            <Typography sx={settingsHintSx}>No event types created yet.</Typography>
                                        ) : (
                                            myEventTypes.map((eventType) => (
                                                <Box
                                                    key={String(eventType.id)}
                                                    sx={{
                                                        p: 1,
                                                        borderRadius: appRadii.card,
                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                        bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                    }}
                                                >
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                        <Box>
                                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                                {eventType.title}
                                                            </Typography>
                                                            <Typography sx={settingsHintSx}>
                                                                {eventType.slug} • {eventType.durationMin.toString()} min • {eventType.visibility === 'public' ? 'External guests' : 'Channel'}
                                                            </Typography>
                                                        </Box>
                                                        <Stack direction="row" spacing={0.6} alignItems="center">
                                                            <Chip
                                                                size="small"
                                                                label={eventType.isActive ? 'Live' : 'Off'}
                                                                sx={{
                                                                    bgcolor: eventType.isActive ? 'rgba(56,200,114,0.16)' : alpha(chatColors.textPrimary, 0.08),
                                                                    color: eventType.isActive ? '#b7f3cf' : chatColors.textSecondary,
                                                                }}
                                                            />
                                                            <Button
                                                                size="small"
                                                                onClick={() => void handleToggleEventType(eventType)}
                                                                sx={meetingsSecondaryButtonSx}
                                                            >
                                                                {eventType.isActive ? 'Pause' : 'Enable'}
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                </Box>
                                            ))
                                        )}
                                    </Stack>
                                </SettingsSubsection>

                                <PreviewPanel
                                    title="Live preview"
                                    description="This is how the booking option card will read on the public page."
                                >
                                    <Box
                                        sx={{
                                            p: 1.4,
                                            borderRadius: appRadii.card,
                                            border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                            bgcolor: chatColors.panelBg,
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                                <Box>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.86rem', fontWeight: 800 }}>
                                                        {eventTitle.trim() || 'Office hours'}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.72rem', lineHeight: 1.5 }}>
                                                        {eventDescription.trim() || 'A short office meeting for updates, planning, or questions.'}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    size="small"
                                                    label={eventActive ? 'Live' : 'Draft'}
                                                    sx={{
                                                        bgcolor: eventActive ? 'rgba(56,200,114,0.16)' : alpha(chatColors.textPrimary, 0.08),
                                                        color: eventActive ? '#b7f3cf' : chatColors.textSecondary,
                                                    }}
                                                />
                                            </Stack>
                                            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                                <Chip size="small" label={`${eventDurationMin || '30'} min`} sx={{ bgcolor: alpha(chatColors.textPrimary, 0.06), color: chatColors.textSecondary }} />
                                                <Chip
                                                    size="small"
                                                    label={eventVisibility === 'public' ? 'External guests' : 'Channel members'}
                                                    sx={{ bgcolor: alpha(chatColors.textPrimary, 0.06), color: chatColors.textSecondary }}
                                                />
                                                {eventRequireApproval ? (
                                                    <Chip size="small" label="Approval required" sx={{ bgcolor: 'rgba(255,190,73,0.14)', color: '#ffd28a' }} />
                                                ) : null}
                                            </Stack>
                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.66rem' }}>
                                                /u/{handle.trim().toLowerCase() || 'your-handle'}/{eventSlug.trim().toLowerCase() || 'event'}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                </PreviewPanel>
                            </Stack>
                        </SettingsSection>
                    ) : null}

                    {activeStep === 'defaults' ? (
                    <Stack spacing={1.6}>
                        <SettingsSection
                            icon={<ShieldRoundedIcon sx={{ fontSize: 16 }} />}
                            title="Step 3. Availability and policy"
                            description="Set your standard working hours, recording defaults, and the follow-up checklist used after meetings."
                        >
                            <Stack spacing={1.2}>
                                <SettingsSubsection
                                    title="Weekly availability"
                                    description="Choose the days and hours people can book. Mark a day closed if you do not take meetings that day."
                                >
                                    <Stack spacing={1}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 1 }}>
                                            <TextField
                                                select
                                                label="Booking type"
                                                value={availabilityEventTypeId}
                                                onChange={(event) => setAvailabilityEventTypeId(event.target.value)}
                                                size="small"
                                                sx={meetingsInputSx}
                                                helperText="Pick the kind of meeting you want to make available."
                                            >
                                                {myEventTypes.map((eventType) => (
                                                    <MenuItem key={String(eventType.id)} value={String(eventType.id)}>
                                                        {eventType.title}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                            <TextField
                                                label="Timezone"
                                                value={availabilityTimezone}
                                                onChange={(event) => setAvailabilityTimezone(event.target.value)}
                                                size="small"
                                                sx={meetingsInputSx}
                                                helperText="Use the timezone your office schedule follows."
                                            />
                                        </Box>

                                        <Box
                                            sx={{
                                                p: 1.1,
                                                borderRadius: appRadii.card,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.02),
                                            }}
                                        >
                                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                                <Stack spacing={0.25}>
                                                    <Stack direction="row" spacing={0.8} alignItems="center">
                                                        <AccessTimeRoundedIcon sx={{ fontSize: 15, color: chatColors.textSecondary }} />
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                            Office hours summary
                                                        </Typography>
                                                    </Stack>
                                                    <Typography sx={settingsHintSx}>{formatOfficeHoursSummary(weeklyAvailability)}</Typography>
                                                </Stack>
                                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                                    <Button
                                                        size="small"
                                                        onClick={() =>
                                                            setWeeklyAvailability(
                                                                DEFAULT_WEEKLY_AVAILABILITY.map((day) => ({ ...day }))
                                                            )
                                                        }
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        Use standard office hours
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() =>
                                                            setWeeklyAvailability((prev) =>
                                                                prev.map((day) => ({
                                                                    ...day,
                                                                    enabled: day.weekday >= 1 && day.weekday <= 5,
                                                                }))
                                                            )
                                                        }
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        Close weekends
                                                    </Button>
                                                </Stack>
                                            </Stack>
                                        </Box>

                                        <Stack spacing={0.8}>
                                            {FULL_WEEK_OPTIONS.map((dayOption) => {
                                                const dayValue = Number(dayOption.value);
                                                const dayState = weeklyAvailability.find((day) => day.weekday === dayValue) || DEFAULT_WEEKLY_AVAILABILITY[dayValue];
                                                return (
                                                    <Box
                                                        key={dayValue}
                                                        sx={{
                                                            p: 1,
                                                            borderRadius: appRadii.card,
                                                            border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                            bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                        }}
                                                    >
                                                        <Stack spacing={0.8}>
                                                            <Stack
                                                                direction={{ xs: 'column', md: 'row' }}
                                                                spacing={1}
                                                                alignItems={{ xs: 'flex-start', md: 'center' }}
                                                                justifyContent="space-between"
                                                            >
                                                                <Box>
                                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 700 }}>
                                                                        {dayOption.label}
                                                                    </Typography>
                                                                    <Typography sx={settingsHintSx}>{dayOption.helper}</Typography>
                                                                </Box>
                                                                <FormControlLabel
                                                                    control={
                                                                        <Switch
                                                                            checked={dayState.enabled}
                                                                            onChange={(event) =>
                                                                                setWeeklyAvailability((prev) =>
                                                                                    prev.map((day) =>
                                                                                        day.weekday === dayValue
                                                                                            ? { ...day, enabled: event.target.checked }
                                                                                            : day
                                                                                    )
                                                                                )
                                                                            }
                                                                        />
                                                                    }
                                                                    label={dayState.enabled ? 'Open for meetings' : 'Closed'}
                                                                    sx={{
                                                                        m: 0,
                                                                        '& .MuiFormControlLabel-label': {
                                                                            color: chatColors.textPrimary,
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 700,
                                                                        },
                                                                    }}
                                                                />
                                                            </Stack>

                                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                                                                <TextField
                                                                    select
                                                                    label="Open at"
                                                                    value={dayState.startMinute}
                                                                    disabled={!dayState.enabled}
                                                                    onChange={(event) =>
                                                                        setWeeklyAvailability((prev) =>
                                                                            prev.map((day) =>
                                                                                day.weekday === dayValue
                                                                                    ? { ...day, startMinute: event.target.value }
                                                                                    : day
                                                                            )
                                                                        )
                                                                    }
                                                                    size="small"
                                                                    sx={meetingsInputSx}
                                                                >
                                                                    {TIME_OPTIONS.map((time) => (
                                                                        <MenuItem key={`start-${dayValue}-${time.value}`} value={time.value}>
                                                                            {time.label}
                                                                        </MenuItem>
                                                                    ))}
                                                                </TextField>
                                                                <TextField
                                                                    select
                                                                    label="Close at"
                                                                    value={dayState.endMinute}
                                                                    disabled={!dayState.enabled}
                                                                    onChange={(event) =>
                                                                        setWeeklyAvailability((prev) =>
                                                                            prev.map((day) =>
                                                                                day.weekday === dayValue
                                                                                    ? { ...day, endMinute: event.target.value }
                                                                                    : day
                                                                            )
                                                                        )
                                                                    }
                                                                    size="small"
                                                                    sx={meetingsInputSx}
                                                                >
                                                                    {TIME_OPTIONS.map((time) => (
                                                                        <MenuItem key={`end-${dayValue}-${time.value}`} value={time.value}>
                                                                            {time.label}
                                                                        </MenuItem>
                                                                    ))}
                                                                </TextField>
                                                            </Box>
                                                        </Stack>
                                                    </Box>
                                                );
                                            })}
                                        </Stack>

                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                            <Typography sx={settingsHintSx}>
                                                Saved rules for this booking type: {availabilityRulesForSelected.length}. Closed days are kept in the schedule so your week is clear to anyone managing it later.
                                            </Typography>
                                            <Button onClick={() => void handleSetAvailability()} sx={meetingsPrimaryButtonSx}>
                                                Save office hours
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </SettingsSubsection>

                                <SettingsSubsection
                                    title="Recording policy"
                                    description="Use one workspace default for all hosted meetings."
                                    action={
                                        <Button onClick={applyDefaultsFromPolicy} size="small" sx={meetingsSecondaryButtonSx}>
                                            Load current
                                        </Button>
                                    }
                                >
                                    <Stack spacing={1}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                                            <TextField
                                                select
                                                label="Recording mode"
                                                value={recordingMode}
                                                onChange={(event) => setRecordingMode(event.target.value as 'off' | 'optional' | 'required')}
                                                size="small"
                                                sx={meetingsInputSx}
                                            >
                                                <MenuItem value="off">Off</MenuItem>
                                                <MenuItem value="optional">Optional</MenuItem>
                                                <MenuItem value="required">Required</MenuItem>
                                            </TextField>
                                            <TextField
                                                label="Retention (days)"
                                                value={recordingRetention}
                                                onChange={(event) => setRecordingRetention(event.target.value)}
                                                size="small"
                                                sx={meetingsInputSx}
                                            />
                                        </Box>
                                        <TextField
                                            label="Internal note"
                                            value={recordingDescription}
                                            onChange={(event) => setRecordingDescription(event.target.value)}
                                            size="small"
                                            sx={meetingsInputSx}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={recordingAuto} onChange={(event) => setRecordingAuto(event.target.checked)} />}
                                            label="Auto-start recording when allowed"
                                            sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.78rem' } }}
                                        />
                                        <Stack direction="row" justifyContent="flex-end">
                                            <Button onClick={() => void handleSetRecordingPolicy()} sx={meetingsPrimaryButtonSx}>
                                                Save recording policy
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </SettingsSubsection>
                            </Stack>
                        </SettingsSection>
                        <SettingsSection
                            icon={<ChecklistRoundedIcon sx={{ fontSize: 16 }} />}
                            title="Follow-up templates"
                            description="Store the checklist you want sent after a meeting ends."
                        >
                            <Stack spacing={1.2}>
                                <SettingsSubsection
                                    title="Create follow-up checklist"
                                    description="This template is used when you send a post-meeting nudge."
                                >
                                    <Stack spacing={1}>
                                        <TextField
                                            label="Template name"
                                            value={templateTitle}
                                            onChange={(event) => setTemplateTitle(event.target.value)}
                                            size="small"
                                            sx={meetingsInputSx}
                                        />
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: appRadii.card,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.02),
                                            }}
                                        >
                                            <Stack spacing={0.9}>
                                                <Box>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.78rem', fontWeight: 700 }}>
                                                        Checklist items
                                                    </Typography>
                                                    <Typography sx={settingsHintSx}>
                                                        Add the tasks an office manager or meeting host should complete after the meeting.
                                                    </Typography>
                                                </Box>
                                                {templateItems.map((item, index) => (
                                                    <Stack key={`template-item-${index}`} direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                                                        <TextField
                                                            label={`Task ${index + 1}`}
                                                            value={item}
                                                            onChange={(event) =>
                                                                setTemplateItems((prev) =>
                                                                    prev.map((existing, itemIndex) =>
                                                                        itemIndex === index ? event.target.value : existing
                                                                    )
                                                                )
                                                            }
                                                            size="small"
                                                            fullWidth
                                                            sx={meetingsInputSx}
                                                            placeholder="Example: Send the meeting summary to the team"
                                                        />
                                                        <Button
                                                            onClick={() =>
                                                                setTemplateItems((prev) =>
                                                                    prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)
                                                                )
                                                            }
                                                            sx={meetingsSecondaryButtonSx}
                                                            disabled={templateItems.length === 1}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </Stack>
                                                ))}
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                                    <Typography sx={settingsHintSx}>
                                                        Keep it short and practical so anyone in the office can follow it.
                                                    </Typography>
                                                    <Button
                                                        onClick={() =>
                                                            setTemplateItems((prev) => [...prev, ''])
                                                        }
                                                        sx={meetingsSecondaryButtonSx}
                                                    >
                                                        Add another task
                                                    </Button>
                                                </Stack>
                                            </Stack>
                                        </Box>
                                        <FormControlLabel
                                            control={<Switch checked={templateDefault} onChange={(event) => setTemplateDefault(event.target.checked)} />}
                                            label="Use as the default follow-up template"
                                            sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.78rem' } }}
                                        />
                                        <Stack direction="row" justifyContent="flex-end">
                                            <Button onClick={() => void handleCreateTemplate()} sx={meetingsPrimaryButtonSx}>
                                                Save follow-up template
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </SettingsSubsection>

                                <SettingsSubsection
                                    title="Saved follow-up templates"
                                    description="Quick reference for the templates already available."
                                >
                                    <Stack spacing={0.8}>
                                        {orgTemplates.length === 0 ? (
                                            <Typography sx={settingsHintSx}>No follow-up templates yet.</Typography>
                                        ) : (
                                            orgTemplates.slice(0, 5).map((template) => (
                                                <Box
                                                    key={String(template.id)}
                                                    sx={{
                                                        p: 1,
                                                        borderRadius: appRadii.card,
                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                        bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                    }}
                                                >
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.74rem', fontWeight: 700 }}>
                                                        {template.title}
                                                    </Typography>
                                                    <Typography sx={settingsHintSx}>
                                                        {template.isDefault ? 'Default template' : 'Custom template'}
                                                    </Typography>
                                                    {parseTemplateItems(template.itemsJson).length > 0 ? (
                                                        <Stack spacing={0.35} sx={{ mt: 0.8 }}>
                                                            {parseTemplateItems(template.itemsJson).slice(0, 4).map((item, index) => (
                                                                <Typography
                                                                    key={`${String(template.id)}-${index}`}
                                                                    sx={{
                                                                        color: chatColors.textSecondary,
                                                                        fontSize: '0.73rem',
                                                                        lineHeight: 1.45,
                                                                    }}
                                                                >
                                                                    {index + 1}. {item}
                                                                </Typography>
                                                            ))}
                                                        </Stack>
                                                    ) : null}
                                                </Box>
                                            ))
                                        )}
                                    </Stack>
                                </SettingsSubsection>
                            </Stack>
                        </SettingsSection>
                    </Stack>
                    ) : null}

                    {activeStep === 'automation' ? (
                        <SettingsSection
                            icon={<NotificationsActiveRoundedIcon sx={{ fontSize: 16 }} />}
                            title="Step 4. Reminder automation"
                        description="Set reminder timing, queue reminder deliveries, and manually send anything already due."
                    >
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.04fr 0.96fr' }, gap: 1.2 }}>
                            <SettingsSubsection
                                title="Reminder template"
                                description="Define when reminders should be sent before a booking starts."
                            >
                                <Stack spacing={1}>
                                    <TextField
                                        label="Template name"
                                        value={reminderName}
                                        onChange={(event) => setReminderName(event.target.value)}
                                        size="small"
                                        sx={meetingsInputSx}
                                    />
                                    <TextField
                                        label="Offsets (minutes)"
                                        value={reminderOffsets}
                                        onChange={(event) => setReminderOffsets(event.target.value)}
                                        helperText="Example: [1440,60,10]"
                                        size="small"
                                        sx={meetingsInputSx}
                                    />
                                    <TextField
                                        select
                                        label="Applies to"
                                        value={reminderScope}
                                        onChange={(event) => setReminderScope(event.target.value as 'all' | 'public' | 'channel')}
                                        size="small"
                                        sx={meetingsInputSx}
                                    >
                                        <MenuItem value="all">All meetings</MenuItem>
                                        <MenuItem value="public">External guest meetings</MenuItem>
                                        <MenuItem value="channel">Channel meetings only</MenuItem>
                                    </TextField>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                                        <FormControlLabel
                                            control={<Switch checked={reminderDefault} onChange={(event) => setReminderDefault(event.target.checked)} />}
                                            label="Make this the default template"
                                            sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.74rem' } }}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={reminderActive} onChange={(event) => setReminderActive(event.target.checked)} />}
                                            label="Template is active"
                                            sx={{ '& .MuiFormControlLabel-label': { color: chatColors.textPrimary, fontSize: '0.74rem' } }}
                                        />
                                    </Stack>
                                    <Stack direction="row" justifyContent="flex-end">
                                        <Button onClick={() => void handleSaveReminderTemplate()} sx={meetingsPrimaryButtonSx}>
                                            Save reminder template
                                        </Button>
                                    </Stack>

                                    <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />

                                    <Stack spacing={0.8}>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.76rem', fontWeight: 700 }}>
                                            Dispatch queue
                                        </Typography>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                                            <TextField
                                                label="Queue horizon (minutes)"
                                                value={reminderQueueHorizonMin}
                                                onChange={(event) => setReminderQueueHorizonMin(event.target.value)}
                                                size="small"
                                                sx={{ ...meetingsInputSx, flex: 1 }}
                                            />
                                            <Button
                                                onClick={() => void handleQueueReminderDeliveries()}
                                                disabled={isQueueingReminders}
                                                sx={meetingsSecondaryButtonSx}
                                            >
                                                {isQueueingReminders ? 'Queueing...' : 'Queue reminders'}
                                            </Button>
                                            <Button
                                                onClick={() => void handleDispatchDueReminders()}
                                                disabled={isDispatchingDueReminders || dueReminderDeliveries.length === 0}
                                                sx={meetingsPrimaryButtonSx}
                                            >
                                                {isDispatchingDueReminders ? 'Sending...' : `Send due (${dueReminderDeliveries.length})`}
                                            </Button>
                                        </Stack>

                                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                            <Chip size="small" label={`Pending ${orgPendingReminderDeliveries.length}`} sx={{ bgcolor: alpha(chatColors.textPrimary, 0.08), color: chatColors.textPrimary }} />
                                            <Chip size="small" label={`Due now ${dueReminderDeliveries.length}`} sx={{ bgcolor: 'rgba(114,138,255,0.18)', color: '#c7d3ff' }} />
                                            <Chip size="small" label={`Failed ${recentReminderFailures.length}`} sx={{ bgcolor: 'rgba(255,110,110,0.16)', color: '#ffcdcd' }} />
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </SettingsSubsection>

                            <SettingsSubsection
                                title="Queued reminders"
                                description="Review what is waiting to send and manually push a delivery if needed."
                            >
                                <Stack spacing={0.8}>
                                    <Stack spacing={0.6} sx={{ maxHeight: 210, overflow: 'auto', pr: 0.4 }}>
                                        {orgPendingReminderDeliveries.slice(0, 12).map((delivery) => {
                                            const booking = bookings.find((row) => row.id === delivery.bookingId);
                                            const eventType = booking ? eventTypes.find((row) => row.id === booking.eventTypeId) : null;
                                            const isDispatching = dispatchingDeliveryId === delivery.id;
                                            return (
                                                <Box
                                                    key={String(delivery.id)}
                                                    sx={{
                                                        p: 0.9,
                                                        borderRadius: appRadii.card,
                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                        bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                    }}
                                                >
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.8}>
                                                        <Box>
                                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.68rem', fontWeight: 700 }}>
                                                                {booking?.inviteeName || 'Invitee'} • {eventType?.title || 'Meeting'}
                                                            </Typography>
                                                            <Typography sx={settingsHintSx}>
                                                                {formatBookingTimestamp(delivery.triggerAt)} • {delivery.offsetMin.toString()} min • {formatReminderTiming(delivery.triggerAt, reminderNowMs)}
                                                            </Typography>
                                                        </Box>
                                                        <Button
                                                            size="small"
                                                            disabled={isDispatching}
                                                            onClick={() => void handleDispatchReminderDelivery(delivery)}
                                                            sx={meetingsSecondaryButtonSx}
                                                        >
                                                            {isDispatching ? 'Sending...' : 'Send now'}
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            );
                                        })}
                                        {orgPendingReminderDeliveries.length === 0 ? (
                                            <Typography sx={settingsHintSx}>No reminder deliveries are queued right now.</Typography>
                                        ) : null}
                                    </Stack>

                                    {recentReminderFailures.length > 0 ? (
                                        <SettingsSubsection title="Recent failures">
                                            <Stack spacing={0.5}>
                                                {recentReminderFailures.map((delivery) => (
                                                    <Box
                                                        key={String(delivery.id)}
                                                        sx={{
                                                            p: 0.8,
                                                            borderRadius: appRadii.card,
                                                            border: '1px solid rgba(255,110,110,0.18)',
                                                            bgcolor: 'rgba(255,110,110,0.05)',
                                                        }}
                                                    >
                                                        <Typography sx={{ color: '#ffd4d4', fontSize: '0.64rem', fontWeight: 700 }}>
                                                            Delivery {delivery.id.toString()} • {delivery.offsetMin.toString()} min
                                                        </Typography>
                                                        <Typography sx={{ color: '#d4a7a7', fontSize: '0.6rem' }}>
                                                            {delivery.lastError || 'Reminder dispatch failed'}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </SettingsSubsection>
                                    ) : null}

                                    <Stack spacing={0.6}>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.76rem', fontWeight: 700 }}>
                                            Saved reminder templates
                                        </Typography>
                                        {orgReminderTemplates.length === 0 ? (
                                            <Typography sx={settingsHintSx}>No reminder templates saved yet.</Typography>
                                        ) : (
                                            orgReminderTemplates.slice(0, 6).map((template) => (
                                                <Box
                                                    key={String(template.id)}
                                                    sx={{
                                                        p: 0.85,
                                                        borderRadius: appRadii.card,
                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                        bgcolor: alpha(chatColors.textPrimary, 0.02),
                                                    }}
                                                >
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.72rem', fontWeight: 700 }}>
                                                            {template.name}
                                                        </Typography>
                                                        <Stack direction="row" spacing={0.5}>
                                                            {template.isDefault ? (
                                                                <Chip size="small" label="Default" sx={{ bgcolor: 'rgba(114,138,255,0.18)', color: '#bcc9ff' }} />
                                                            ) : null}
                                                            <Chip size="small" label={template.channelScope} sx={{ bgcolor: alpha(chatColors.textPrimary, 0.08), color: chatColors.textSecondary }} />
                                                        </Stack>
                                                    </Stack>
                                                    <Typography sx={settingsHintSx}>{template.offsetsJson}</Typography>
                                                </Box>
                                            ))
                                        )}
                                    </Stack>
                                </Stack>
                            </SettingsSubsection>
                        </Box>
                    </SettingsSection>
                    ) : null}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Typography sx={settingsHintSx}>
                            {setupSteps[activeStepIndex]?.title} - {setupSteps[activeStepIndex]?.helper}
                        </Typography>
                        <Stack direction="row" spacing={0.8}>
                            <Button
                                disabled={!canGoBack}
                                onClick={() => canGoBack && setActiveStep(setupSteps[activeStepIndex - 1]!.id)}
                                sx={meetingsSecondaryButtonSx}
                            >
                                Previous
                            </Button>
                            <Button
                                disabled={!canGoNext}
                                onClick={() => canGoNext && setActiveStep(setupSteps[activeStepIndex + 1]!.id)}
                                sx={meetingsPrimaryButtonSx}
                            >
                                Next
                            </Button>
                        </Stack>
                    </Stack>
                    </Stack>
                </Box>
            </MeetingsPageShell>
        </DashboardLayout>
    );
}
