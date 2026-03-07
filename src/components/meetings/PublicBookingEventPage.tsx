import { useCallback, useEffect, useMemo, useState } from 'react';
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
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { createPublicDyteMeetingAccess } from '../../server/dyte';
import { sendMeetingEmail } from '../../server/meetings';
import { reducers, tables } from '../../module_bindings';
import type {
    MeetingAvailabilityRule as DbMeetingAvailabilityRule,
    MeetingBooking as DbMeetingBooking,
    MeetingEventType as DbMeetingEventType,
    MeetingPublicProfile as DbMeetingPublicProfile,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';
import { meetingsInputSx, meetingsPrimaryButtonSx, meetingsRadius, meetingsSecondaryButtonSx } from './MeetingsUI';
import { chatColors } from '../../theme/chatColors';

type PublicBookingEventPageProps = {
    handle: string;
    eventTypeSlug: string;
};

type SlotDay = {
    key: string;
    date: Date;
    label: string;
    slots: number[];
};

type BookingStep = 'schedule' | 'details' | 'confirmed';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHandle(value: string): string {
    return decodeURIComponent(value || '').trim().toLowerCase();
}

function normalizeSlug(value: string): string {
    return decodeURIComponent(value || '').trim().toLowerCase();
}

function dayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLong(ts: number): string {
    return new Date(ts).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDateHeading(date: Date): string {
    return date.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

function formatTimeRange(startMs: number, durationMin: number): string {
    const endMs = startMs + durationMin * 60 * 1000;
    return `${formatTime(startMs)} - ${formatTime(endMs)}`;
}

function formatDayMeta(date: Date): { weekday: string; date: string } {
    return {
        weekday: date.toLocaleDateString([], { weekday: 'short' }),
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

const pageBgSx = {
    bgcolor: chatColors.pageBg,
    backgroundImage: `radial-gradient(circle at top left, ${alpha(chatColors.textPrimary, 0.12)} 0%, transparent 24%), radial-gradient(circle at top right, ${alpha(chatColors.actionBg, 0.1)} 0%, transparent 18%), linear-gradient(180deg, ${chatColors.pageBg} 0%, #020202 100%)`,
};

const panelBorder = `1px solid ${alpha(chatColors.textPrimary, 0.06)}`;
const softBorder = `1px solid ${alpha(chatColors.textPrimary, 0.08)}`;
const panelSx = {
    borderRadius: meetingsRadius.panel,
    border: panelBorder,
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
const subtleTextSx = { color: chatColors.textSecondary, fontSize: '0.8rem', lineHeight: 1.6 };

export function PublicBookingEventPage({ handle, eventTypeSlug }: PublicBookingEventPageProps) {
    const navigate = useNavigate();
    const createMeetingBookingReducer = useReducer(reducers.createMeetingBooking);

    const [allProfiles] = useSpacetimeDBQuery(tables.meeting_public_profile);
    const [allEventTypes] = useSpacetimeDBQuery(tables.meeting_event_type);
    const [allUsers] = useSpacetimeDBQuery(tables.user);
    const [allOrganizations] = useSpacetimeDBQuery(tables.organization);
    const [allAvailabilityRules] = useSpacetimeDBQuery(tables.meeting_availability_rule);
    const [allBookings] = useSpacetimeDBQuery(tables.meeting_booking);

    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const users = (allUsers || []) as DbUser[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const availabilityRules = (allAvailabilityRules || []) as DbMeetingAvailabilityRule[];
    const bookings = (allBookings || []) as DbMeetingBooking[];

    const [inviteeName, setInviteeName] = useState('');
    const [inviteeEmail, setInviteeEmail] = useState('');
    const [inviteeTimezone, setInviteeTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const [notes, setNotes] = useState('');
    const [selectedDayKey, setSelectedDayKey] = useState('');
    const [selectedStartMs, setSelectedStartMs] = useState<number | null>(null);
    const [activeStep, setActiveStep] = useState<BookingStep>('schedule');
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bookedSlot, setBookedSlot] = useState<number | null>(null);
    const [awaitingApproval, setAwaitingApproval] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [conflictSuggestions, setConflictSuggestions] = useState<number[]>([]);
    const [emailedBookingToken, setEmailedBookingToken] = useState('');

    const normalizedHandle = normalizeHandle(handle);
    const normalizedSlug = normalizeSlug(eventTypeSlug);
    const normalizedInviteeEmail = inviteeEmail.trim().toLowerCase();

    const profile = useMemo(() => {
        return profiles.find((row) => row.handle.trim().toLowerCase() === normalizedHandle) || null;
    }, [normalizedHandle, profiles]);

    const owner = useMemo(() => {
        if (!profile) return null;
        return users.find((row) => row.id === profile.userId) || null;
    }, [profile, users]);

    const organization = useMemo(() => {
        if (!profile) return null;
        return organizations.find((row) => row.id === profile.orgId) || null;
    }, [organizations, profile]);

    const eventType = useMemo(() => {
        if (!profile) return null;
        return (
            eventTypes.find((row) =>
                row.orgId === profile.orgId &&
                row.ownerUserId === profile.userId &&
                row.slug.trim().toLowerCase() === normalizedSlug &&
                row.isActive
            ) || null
        );
    }, [eventTypes, normalizedSlug, profile]);

    const eventAvailabilityRules = useMemo(() => {
        if (!eventType || !owner) return [];
        return availabilityRules.filter((rule) =>
            rule.eventTypeId === eventType.id &&
            rule.userId === owner.id &&
            rule.isEnabled
        );
    }, [availabilityRules, eventType, owner]);

    const hostBookings = useMemo(() => {
        if (!eventType || !owner) return [];
        return bookings.filter((booking) =>
            booking.eventTypeId === eventType.id &&
            booking.hostUserId === owner.id &&
            booking.status === 'confirmed'
        );
    }, [bookings, eventType, owner]);

    const slotDays = useMemo(() => {
        if (!eventType || !owner || eventAvailabilityRules.length === 0) return [] as SlotDay[];

        const now = Date.now();
        const minNoticeMs = Number(eventType.minNoticeMin) * 60 * 1000;
        const durationMin = Number(eventType.durationMin);
        const durationMs = durationMin * 60 * 1000;
        const stepMin = Math.max(15, Math.min(durationMin, 60));
        const maxDays = Math.min(Math.max(Number(eventType.maxDaysInAdvance), 1), 45);

        const byWeekday = new Map<number, DbMeetingAvailabilityRule[]>();
        for (const rule of eventAvailabilityRules) {
            const weekday = Number(rule.weekday);
            const list = byWeekday.get(weekday) || [];
            list.push(rule);
            byWeekday.set(weekday, list);
        }

        const days: SlotDay[] = [];
        for (let offset = 0; offset <= maxDays; offset += 1) {
            const dayDate = new Date();
            dayDate.setHours(0, 0, 0, 0);
            dayDate.setDate(dayDate.getDate() + offset);
            const weekday = dayDate.getDay();
            const rules = byWeekday.get(weekday) || [];
            if (rules.length === 0) continue;

            const slots: number[] = [];
            for (const rule of rules) {
                const startMinute = Number(rule.startMinute);
                const endMinute = Number(rule.endMinute);
                for (let minute = startMinute; minute + durationMin <= endMinute; minute += stepMin) {
                    const slotDate = new Date(dayDate);
                    const hour = Math.floor(minute / 60);
                    const minutePart = minute % 60;
                    slotDate.setHours(hour, minutePart, 0, 0);
                    const startMs = slotDate.getTime();
                    const endMs = startMs + durationMs;

                    if (startMs < now + minNoticeMs) continue;

                    let overlaps = false;
                    for (const booking of hostBookings) {
                        const bookedStart = Number(booking.startsAt);
                        const bookedEnd = Number(booking.endsAt);
                        if (startMs < bookedEnd && endMs > bookedStart) {
                            overlaps = true;
                            break;
                        }
                    }
                    if (!overlaps) slots.push(startMs);
                }
            }

            if (slots.length > 0) {
                days.push({
                    key: dayKey(dayDate),
                    date: dayDate,
                    label: dayDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
                    slots: slots.sort((a, b) => a - b),
                });
            }
        }

        return days;
    }, [eventAvailabilityRules, eventType, hostBookings, owner]);

    const selectedDay = useMemo(() => slotDays.find((day) => day.key === selectedDayKey) || null, [selectedDayKey, slotDays]);
    const confirmedBooking = useMemo(() => {
        if (!eventType || bookedSlot == null || !normalizedInviteeEmail) return null;
        let latest: DbMeetingBooking | null = null;
        for (const booking of bookings) {
            if (
                booking.eventTypeId === eventType.id &&
                Number(booking.startsAt) === bookedSlot &&
                booking.inviteeEmail.trim().toLowerCase() === normalizedInviteeEmail
            ) {
                if (!latest || booking.createdAt > latest.createdAt) {
                    latest = booking;
                }
            }
        }
        return latest;
    }, [bookedSlot, bookings, eventType, normalizedInviteeEmail]);
    const slotDaysByKey = useMemo(() => new Map(slotDays.map((day) => [day.key, day])), [slotDays]);

    useEffect(() => {
        if (slotDays.length === 0) {
            setSelectedDayKey('');
            setSelectedStartMs(null);
            setActiveStep('schedule');
            return;
        }
        if (!selectedDayKey || !slotDays.some((day) => day.key === selectedDayKey)) {
            setSelectedDayKey('');
            setSelectedStartMs(null);
            setActiveStep('schedule');
        }
    }, [selectedDayKey, slotDays]);

    useEffect(() => {
        if (!selectedDayKey && activeStep !== 'schedule') {
            setActiveStep('schedule');
            return;
        }
        if (selectedDayKey && !selectedStartMs && activeStep === 'details') {
            setActiveStep('schedule');
        }
    }, [activeStep, selectedDayKey, selectedStartMs]);

    useEffect(() => {
        if (selectedDay) {
            setCalendarMonth(new Date(selectedDay.date.getFullYear(), selectedDay.date.getMonth(), 1));
            return;
        }
        if (slotDays.length > 0) {
            const first = slotDays[0].date;
            setCalendarMonth((current) => {
                if (
                    current.getFullYear() === first.getFullYear() &&
                    current.getMonth() === first.getMonth()
                ) {
                    return current;
                }
                return new Date(first.getFullYear(), first.getMonth(), 1);
            });
        }
    }, [selectedDay, slotDays]);

    const isLoading =
        allProfiles == null ||
        allEventTypes == null ||
        allUsers == null ||
        allOrganizations == null ||
        allAvailabilityRules == null ||
        allBookings == null;

    const handleCreateBooking = async () => {
        if (!eventType || !profile) return;
        if (!selectedStartMs) {
            toast.message('Select a time slot');
            return;
        }
        if (inviteeName.trim().length < 2) {
            toast.message('Enter your name');
            return;
        }
        if (!EMAIL_PATTERN.test(inviteeEmail.trim().toLowerCase())) {
            toast.message('Enter a valid email');
            return;
        }

        setBookingError(null);
        setConflictSuggestions([]);
        setIsSubmitting(true);
        try {
            let dyteMeetingId = '';
            if (!eventType.requireApproval) {
                const meetingSeed = await createPublicDyteMeetingAccess({
                    data: {
                        orgName: organization?.name || 'Workspace',
                        eventTitle: eventType.title,
                        inviteeName: inviteeName.trim(),
                    },
                } as any);

                if (!meetingSeed.success || !meetingSeed.meetingId) {
                    throw new Error(meetingSeed.error || 'Could not create meeting');
                }
                dyteMeetingId = meetingSeed.meetingId;
            }

            await createMeetingBookingReducer({
                eventTypeId: eventType.id,
                inviteeName: inviteeName.trim(),
                inviteeEmail: inviteeEmail.trim().toLowerCase(),
                inviteeTimezone: inviteeTimezone.trim(),
                startsAt: BigInt(selectedStartMs),
                notes: notes.trim(),
                dyteMeetingId,
            });

            setBookedSlot(selectedStartMs);
            setAwaitingApproval(eventType.requireApproval);
            setBookingError(null);
            setConflictSuggestions([]);
            setActiveStep('confirmed');
            toast.success(eventType.requireApproval ? 'Booking request sent for approval' : 'Meeting booked');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not complete booking';
            toast.error(message);
            setBookingError(message);

            const lower = message.toLowerCase();
            if (lower.includes('overlap') || lower.includes('available') || lower.includes('too soon')) {
                const candidates = slotDays
                    .flatMap((day) => day.slots)
                    .filter((slotMs) => slotMs !== selectedStartMs)
                    .sort((a, b) => Math.abs(a - selectedStartMs) - Math.abs(b - selectedStartMs))
                    .slice(0, 6);
                setConflictSuggestions(candidates);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!confirmedBooking || !eventType || !profile) return;
        if (emailedBookingToken === confirmedBooking.bookingToken) return;

        let cancelled = false;

        const sendGuestEmail = async () => {
            try {
                const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                const manageUrl = baseOrigin ? `${baseOrigin}/booking/${confirmedBooking.bookingToken}` : undefined;
                const publicUrl = baseOrigin ? `${baseOrigin}/u/${profile.handle}/${eventType.slug}` : undefined;
                const emailResult = await sendMeetingEmail({
                    data: {
                        kind: awaitingApproval ? 'booking_requested' : 'booking_confirmed',
                        toEmail: confirmedBooking.inviteeEmail,
                        toName: confirmedBooking.inviteeName,
                        orgName: organization?.name || 'Workspace',
                        eventTitle: eventType.title,
                        startsAt: Number(confirmedBooking.startsAt),
                        durationMin: Number(eventType.durationMin),
                        timezone: confirmedBooking.inviteeTimezone,
                        notes: confirmedBooking.notes,
                        manageUrl,
                        publicUrl,
                    } as any,
                });
                if (!cancelled) {
                    if (!emailResult?.success) {
                        console.warn('Meeting email send failed:', emailResult?.error);
                        return;
                    }
                    setEmailedBookingToken(confirmedBooking.bookingToken);
                }
            } catch (emailError) {
                console.warn('Meeting email send threw error:', emailError);
            }
        };

        void sendGuestEmail();

        return () => {
            cancelled = true;
        };
    }, [awaitingApproval, confirmedBooking, emailedBookingToken, eventType, organization?.name, profile]);

    const copyManageLink = useCallback(async () => {
        if (!confirmedBooking || typeof window === 'undefined') return;
        const manageUrl = `${window.location.origin}/booking/${confirmedBooking.bookingToken}`;
        await navigator.clipboard.writeText(manageUrl);
        toast.success('Manage link copied');
    }, [confirmedBooking]);

    if (isLoading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', ...pageBgSx }}>
                <Stack spacing={1.3} alignItems="center">
                    <CircularProgress sx={{ color: chatColors.actionBg }} />
                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem' }}>
                        Loading booking availability...
                    </Typography>
                </Stack>
            </Box>
        );
    }

    if (!profile || !profile.bookingEnabled || !eventType) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, ...pageBgSx }}>
                <Paper sx={{ ...panelSx, p: 3, maxWidth: 560, width: '100%' }}>
                    <Stack spacing={1.4}>
                        <Typography sx={{ color: chatColors.textPrimary, fontWeight: 800, fontSize: '1.12rem' }}>
                            Event unavailable
                        </Typography>
                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.9rem', lineHeight: 1.6 }}>
                            The selected meeting type was not found or is currently disabled.
                        </Typography>
                        <Box>
                            <Button
                                onClick={() =>
                                    void navigate({
                                        to: '/u/$handle',
                                        params: { handle: normalizeHandle(handle) || 'unknown' },
                                    })
                                }
                                startIcon={<ArrowBackRoundedIcon />}
                                sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                            >
                                Back
                            </Button>
                        </Box>
                    </Stack>
                </Paper>
            </Box>
        );
    }

    const hostName = owner?.name || profile.handle;
    const hostInitial = hostName.trim().charAt(0).toUpperCase();
    const selectedSlotLabel = selectedStartMs ? formatLong(selectedStartMs) : 'Choose a date and time';
    const selectedTimeRange = selectedStartMs ? formatTimeRange(selectedStartMs, Number(eventType.durationMin)) : 'Select a slot to continue';
    const pageTitle = activeStep === 'confirmed'
        ? awaitingApproval
            ? `Request sent to ${hostName}`
            : `Booking confirmed with ${hostName}`
        : `Reserve time with ${hostName}`;
    const pageDescription = activeStep === 'confirmed'
        ? awaitingApproval
            ? `Your request for ${eventType.title.toLowerCase()} is waiting for approval.`
            : `Your ${eventType.title.toLowerCase()} is booked and ready.`
        : `Pick an available day, choose a start time, and confirm the details for ${eventType.title.toLowerCase()}.`;
    const monthLabel = calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const calendarCells = Array.from({ length: 35 }, (_, index) => {
        const date = addDays(gridStart, index);
        const key = dayKey(date);
        const availableDay = slotDaysByKey.get(key) || null;
        return {
            key,
            date,
            inMonth: date.getMonth() === calendarMonth.getMonth(),
            availableDay,
        };
    });

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
                            {pageTitle}
                        </Typography>
                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.88rem', maxWidth: 760, lineHeight: 1.65 }}>
                            {pageDescription}
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
                                            {eventType.title}
                                        </Typography>
                                        <Typography sx={subtleTextSx}>
                                            {eventType.description || profile.headline || 'Choose a time that works and complete the booking form to confirm the request.'}
                                        </Typography>
                                    </Stack>
                                </Stack>

                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        size="small"
                                        icon={<AccessTimeRoundedIcon sx={{ fontSize: 14 }} />}
                                        label={`${eventType.durationMin.toString()} min`}
                                        sx={{
                                            bgcolor: alpha(chatColors.textPrimary, 0.06),
                                            color: chatColors.textPrimary,
                                            borderRadius: meetingsRadius.badge,
                                            '& .MuiChip-icon': { color: chatColors.textSecondary },
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        icon={<PublicRoundedIcon sx={{ fontSize: 14 }} />}
                                        label={profile.timezone || inviteeTimezone}
                                        sx={{
                                            bgcolor: alpha(chatColors.textPrimary, 0.06),
                                            color: chatColors.textSecondary,
                                            borderRadius: meetingsRadius.badge,
                                            '& .MuiChip-icon': { color: chatColors.textSecondary },
                                        }}
                                    />
                                    <Chip
                                        size="small"
                                        label={eventType.requireApproval ? 'Approval required' : 'Instant confirmation'}
                                        sx={{
                                            bgcolor: eventType.requireApproval ? alpha(chatColors.warning, 0.16) : alpha(chatColors.success, 0.16),
                                            color: eventType.requireApproval ? '#ffd59a' : '#b7f3cf',
                                            borderRadius: meetingsRadius.badge,
                                        }}
                                    />
                                </Stack>

                                <Paper sx={{ ...insetPanelSx, p: 1.5 }}>
                                    <Stack spacing={0.8}>
                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            Current selection
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.94rem', fontWeight: 700, lineHeight: 1.45 }}>
                                            {selectedSlotLabel}
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                            {selectedTimeRange}
                                        </Typography>
                                    </Stack>
                                </Paper>

                                {activeStep === 'confirmed' && (
                                    <Paper sx={{ ...insetPanelSx, p: 1.5 }}>
                                        <Stack spacing={0.65}>
                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                                Next
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.78rem', fontWeight: 700 }}>
                                                {awaitingApproval ? 'Watch your email for host approval' : 'Use the manage page to reschedule or cancel later'}
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.55 }}>
                                                {awaitingApproval
                                                    ? 'Once approved, the host will send the final confirmation and meeting access.'
                                                    : 'Your manage page keeps the guest link, meeting details, and any later changes in one place.'}
                                            </Typography>
                                        </Stack>
                                    </Paper>
                                )}

                                <Button
                                    onClick={() =>
                                        void navigate({
                                            to: '/u/$handle',
                                            params: { handle: profile.handle },
                                        })
                                    }
                                    startIcon={<ArrowBackRoundedIcon />}
                                    sx={[meetingsSecondaryButtonSx, { alignSelf: 'flex-start', ...secondaryButtonOverrideSx }]}
                                >
                                    All events
                                </Button>
                            </Stack>
                        </Paper>

                        <Paper sx={{ ...panelSx, p: { xs: 1.2, md: 1.6 } }}>
                            <Stack spacing={1.4}>
                                {activeStep === 'schedule' ? (
                                    <Paper sx={{ ...insetPanelSx, p: 1.5, minHeight: 520 }}>
                                        <Stack spacing={1.3}>
                                            {slotDays.length === 0 ? (
                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.8rem', lineHeight: 1.6 }}>
                                                        No available slots were found within the allowed scheduling range.
                                                    </Typography>
                                                </Paper>
                                            ) : (
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' }, gap: 1.4 }}>
                                                    <Paper sx={{ ...insetPanelSx, p: 1.2 }}>
                                                        <Stack spacing={1}>
                                                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.96rem', fontWeight: 700 }}>
                                                                    {monthLabel}
                                                                </Typography>
                                                                <Stack direction="row" spacing={0.3}>
                                                                    <Button
                                                                        onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                                                                        sx={{ minWidth: 0, px: 0.9, borderRadius: meetingsRadius.control, color: chatColors.textSecondary }}
                                                                    >
                                                                        <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                                                                        sx={{ minWidth: 0, px: 0.9, borderRadius: meetingsRadius.control, color: chatColors.textSecondary }}
                                                                    >
                                                                        <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                                                                    </Button>
                                                                </Stack>
                                                            </Stack>

                                                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.45 }}>
                                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                                                                    <Typography
                                                                        key={label}
                                                                        sx={{ color: chatColors.textMuted, textAlign: 'center', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', py: 0.4 }}
                                                                    >
                                                                        {label}
                                                                    </Typography>
                                                                ))}
                                                                {calendarCells.map((cell) => {
                                                                    const selected = selectedDayKey === cell.key;
                                                                    const available = !!cell.availableDay;
                                                                    return (
                                                                        <Button
                                                                            key={cell.key}
                                                                            onClick={() => {
                                                                                if (!available) return;
                                                                                setSelectedDayKey(cell.key);
                                                                                setSelectedStartMs(null);
                                                                            }}
                                                                            disabled={!available}
                                                                            sx={{
                                                                                minWidth: 0,
                                                                                minHeight: 54,
                                                                                p: 0.5,
                                                                                borderRadius: meetingsRadius.control,
                                                                                textTransform: 'none',
                                                                                border: 'none',
                                                                                bgcolor: selected ? alpha(chatColors.textPrimary, 0.12) : 'transparent',
                                                                                color: available
                                                                                    ? cell.inMonth
                                                                                        ? chatColors.textPrimary
                                                                                        : chatColors.textSecondary
                                                                                    : alpha(chatColors.textSecondary, 0.35),
                                                                                opacity: cell.inMonth ? 1 : 0.72,
                                                                                '&.Mui-disabled': {
                                                                                    color: alpha(chatColors.textSecondary, 0.35),
                                                                                },
                                                                                '&:hover': {
                                                                                    bgcolor: available ? alpha(chatColors.textPrimary, 0.08) : 'transparent',
                                                                                },
                                                                            }}
                                                                        >
                                                                            <Stack spacing={0.2} alignItems="center">
                                                                                <Typography sx={{ fontSize: '0.8rem', fontWeight: selected ? 800 : 700 }}>
                                                                                    {cell.date.getDate()}
                                                                                </Typography>
                                                                            </Stack>
                                                                        </Button>
                                                                    );
                                                                })}
                                                            </Box>
                                                        </Stack>
                                                    </Paper>

                                                    <Paper sx={{ ...insetPanelSx, p: 1.2 }}>
                                                        <Stack spacing={1}>
                                                            <Stack spacing={0.35}>
                                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                                                    Available times
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.92rem', fontWeight: 700 }}>
                                                                    {selectedDay ? formatDateHeading(selectedDay.date) : 'Select a date'}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.5 }}>
                                                                    {selectedDay ? `Showing times in ${inviteeTimezone}. Choosing one will move you to the details step.` : 'Choose a date on the calendar to see open times.'}
                                                                </Typography>
                                                            </Stack>

                                                            {!selectedDay ? (
                                                                <Paper sx={{ ...insetPanelSx, p: 1.3, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.6 }}>
                                                                        Select a date on the left to load the available time slots.
                                                                    </Typography>
                                                                </Paper>
                                                            ) : (
                                                                <Stack
                                                                    spacing={0.7}
                                                                    sx={{
                                                                        maxHeight: { xs: 320, lg: 430 },
                                                                        overflowY: 'auto',
                                                                        pr: 0.4,
                                                                        mr: -0.4,
                                                                        scrollbarWidth: 'thin',
                                                                        '&::-webkit-scrollbar': {
                                                                            width: 6,
                                                                        },
                                                                        '&::-webkit-scrollbar-thumb': {
                                                                            backgroundColor: alpha(chatColors.textPrimary, 0.14),
                                                                            borderRadius: 999,
                                                                        },
                                                                        '&::-webkit-scrollbar-track': {
                                                                            backgroundColor: 'transparent',
                                                                        },
                                                                    }}
                                                                >
                                                                    {selectedDay.slots.map((slotMs) => (
                                                                        <Button
                                                                            key={slotMs}
                                                                            onClick={() => {
                                                                                setSelectedStartMs(slotMs);
                                                                                setBookingError(null);
                                                                                setActiveStep('details');
                                                                            }}
                                                                            sx={{
                                                                                minHeight: 54,
                                                                                justifyContent: 'space-between',
                                                                                textTransform: 'none',
                                                                                borderRadius: meetingsRadius.control,
                                                                                bgcolor: alpha(chatColors.textPrimary, 0.03),
                                                                                color: chatColors.textPrimary,
                                                                                px: 1.1,
                                                                                flexShrink: 0,
                                                                                '&:hover': { bgcolor: alpha(chatColors.textPrimary, 0.08) },
                                                                            }}
                                                                        >
                                                                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 800 }}>
                                                                                {formatTime(slotMs)}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '0.68rem', color: chatColors.textMuted }}>
                                                                                {formatTimeRange(slotMs, Number(eventType.durationMin))}
                                                                            </Typography>
                                                                        </Button>
                                                                    ))}
                                                                </Stack>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                </Box>
                                            )}
                                        </Stack>
                                    </Paper>
                                ) : activeStep === 'details' ? (
                                    <Paper sx={{ ...insetPanelSx, p: 1.5, minHeight: 520 }}>
                                        <Stack spacing={1.2}>
                                            <Stack spacing={0.35}>
                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                                    Step 2
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '1.04rem', fontWeight: 700 }}>
                                                    Confirm your booking
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.78rem', lineHeight: 1.55 }}>
                                                    Review the selected time and add the contact information the host should use.
                                                </Typography>
                                            </Stack>

                                            <Paper sx={{ ...insetPanelSx, p: 1.25, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                <Stack spacing={0.65}>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                        Booking summary
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.82rem', fontWeight: 700 }}>
                                                        {eventType.title}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.74rem', lineHeight: 1.45 }}>
                                                        {selectedSlotLabel}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem' }}>
                                                        {selectedTimeRange} / {inviteeTimezone}
                                                    </Typography>
                                                </Stack>
                                            </Paper>

                                            <TextField
                                                label="Name"
                                                value={inviteeName}
                                                onChange={(event) => setInviteeName(event.target.value)}
                                                size="small"
                                                disabled={bookedSlot != null}
                                                sx={meetingsInputSx}
                                            />
                                            <TextField
                                                label="Email"
                                                value={inviteeEmail}
                                                onChange={(event) => setInviteeEmail(event.target.value)}
                                                size="small"
                                                type="email"
                                                disabled={bookedSlot != null}
                                                sx={meetingsInputSx}
                                            />
                                            <TextField
                                                label="Timezone"
                                                value={inviteeTimezone}
                                                onChange={(event) => setInviteeTimezone(event.target.value)}
                                                size="small"
                                                disabled={bookedSlot != null}
                                                sx={meetingsInputSx}
                                            />
                                            <TextField
                                                label="Notes (optional)"
                                                value={notes}
                                                onChange={(event) => setNotes(event.target.value)}
                                                size="small"
                                                multiline
                                                minRows={4}
                                                disabled={bookedSlot != null}
                                                sx={meetingsInputSx}
                                            />

                                            <Divider sx={{ borderColor: alpha(chatColors.textPrimary, 0.08) }} />

                                            <Button
                                                onClick={() => void handleCreateBooking()}
                                                disabled={isSubmitting || bookedSlot != null}
                                                startIcon={<EventAvailableRoundedIcon />}
                                                sx={[meetingsPrimaryButtonSx, primaryButtonOverrideSx]}
                                            >
                                                {bookedSlot ? 'Booked' : isSubmitting ? 'Booking...' : eventType.requireApproval ? 'Request booking' : 'Confirm booking'}
                                            </Button>

                                            {bookingError && (
                                                <Paper
                                                    sx={{
                                                        ...insetPanelSx,
                                                        p: 1.15,
                                                        border: `1px solid ${alpha(chatColors.danger, 0.35)}`,
                                                        bgcolor: alpha(chatColors.danger, 0.12),
                                                    }}
                                                >
                                                    <Typography sx={{ color: '#ffb5be', fontSize: '0.76rem', fontWeight: 700 }}>
                                                        Could not book this slot
                                                    </Typography>
                                                    <Typography sx={{ color: '#ffc8cf', fontSize: '0.72rem', mt: 0.25, lineHeight: 1.55 }}>
                                                        {bookingError}
                                                    </Typography>
                                                    {conflictSuggestions.length > 0 && (
                                                        <Stack direction="row" spacing={0.6} sx={{ flexWrap: 'wrap', mt: 0.9 }} useFlexGap>
                                                            {conflictSuggestions.map((slotMs) => (
                                                                <Button
                                                                    key={slotMs}
                                                                    onClick={() => {
                                                                        setSelectedStartMs(slotMs);
                                                                        setBookingError(null);
                                                                    }}
                                                                    size="small"
                                                                    sx={{
                                                                        textTransform: 'none',
                                                                        color: chatColors.textPrimary,
                                                                        bgcolor: alpha(chatColors.textPrimary, 0.08),
                                                                        borderRadius: meetingsRadius.badge,
                                                                        '&:hover': { bgcolor: alpha(chatColors.textPrimary, 0.12) },
                                                                    }}
                                                                >
                                                                    {formatLong(slotMs)}
                                                                </Button>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </Paper>
                                            )}
                                        </Stack>
                                    </Paper>
                                ) : (
                                    <Paper sx={{ ...insetPanelSx, p: { xs: 1.5, md: 2 }, minHeight: 520 }}>
                                        <Stack spacing={1.8} sx={{ maxWidth: 720 }}>
                                            <Stack spacing={0.8}>
                                                <Box
                                                    sx={{
                                                        width: 54,
                                                        height: 54,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        borderRadius: meetingsRadius.card,
                                                        bgcolor: awaitingApproval ? alpha(chatColors.warning, 0.18) : alpha(chatColors.success, 0.16),
                                                        color: awaitingApproval ? '#ffd59a' : '#b7f3cf',
                                                    }}
                                                >
                                                    <EventAvailableRoundedIcon sx={{ fontSize: 28 }} />
                                                </Box>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 800, lineHeight: 1.08 }}>
                                                    {awaitingApproval ? 'Booking request received' : 'Your meeting is booked'}
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.84rem', lineHeight: 1.65, maxWidth: 620 }}>
                                                    {awaitingApproval
                                                        ? `The request has been sent to ${hostName}. You will receive an email when it is approved or changed.`
                                                        : `A confirmation email has been sent to ${normalizedInviteeEmail}. Keep the manage link so you can reschedule or cancel later if needed.`}
                                                </Typography>
                                            </Stack>

                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Meeting
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {eventType.title}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem', lineHeight: 1.55 }}>
                                                            {selectedSlotLabel}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.74rem' }}>
                                                            {selectedTimeRange} / {inviteeTimezone}
                                                        </Typography>
                                                    </Stack>
                                                </Paper>

                                                <Paper sx={{ ...insetPanelSx, p: 1.35, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                            Contact
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.9rem', fontWeight: 800 }}>
                                                            {inviteeName.trim()}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem' }}>
                                                            {normalizedInviteeEmail}
                                                        </Typography>
                                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.74rem' }}>
                                                            Host: {hostName}
                                                        </Typography>
                                                    </Stack>
                                                </Paper>
                                            </Box>

                                            <Paper sx={{ ...insetPanelSx, p: 1.4, bgcolor: alpha(chatColors.textPrimary, 0.03) }}>
                                                <Stack spacing={0.7}>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                        What to do next
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', fontWeight: 700 }}>
                                                        {awaitingApproval ? 'Wait for approval' : 'Keep your manage link'}
                                                    </Typography>
                                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.76rem', lineHeight: 1.6 }}>
                                                        {awaitingApproval
                                                            ? 'The host needs to approve this request before it becomes a final meeting. You will get the update by email.'
                                                            : 'Use the manage page if you need to change the time or cancel the booking later.'}
                                                    </Typography>
                                                </Stack>
                                            </Paper>

                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                {!awaitingApproval && confirmedBooking && (
                                                    <Button
                                                        onClick={() =>
                                                            void navigate({
                                                                to: '/booking/$token',
                                                                params: { token: confirmedBooking.bookingToken },
                                                            })
                                                        }
                                                        sx={[meetingsPrimaryButtonSx, primaryButtonOverrideSx]}
                                                    >
                                                        Open manage page
                                                    </Button>
                                                )}
                                                {confirmedBooking && (
                                                    <Button
                                                        onClick={() => void copyManageLink()}
                                                        sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                                                    >
                                                        Copy manage link
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() =>
                                                        void navigate({
                                                            to: '/u/$handle',
                                                            params: { handle: profile.handle },
                                                        })
                                                    }
                                                    sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                                                >
                                                    All events
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                )}

                                {activeStep !== 'confirmed' && (
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                        <Button
                                            onClick={() => {
                                                if (activeStep === 'details') {
                                                    setActiveStep('schedule');
                                                    return;
                                                }
                                                void navigate({
                                                    to: '/u/$handle',
                                                    params: { handle: profile.handle },
                                                });
                                            }}
                                            startIcon={<ArrowBackRoundedIcon />}
                                            sx={[meetingsSecondaryButtonSx, secondaryButtonOverrideSx]}
                                        >
                                            Back
                                        </Button>
                                        {activeStep === 'schedule' ? (
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.74rem' }}>
                                                Choose a time to continue
                                            </Typography>
                                        ) : (
                                            <Box />
                                        )}
                                    </Stack>
                                )}
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
