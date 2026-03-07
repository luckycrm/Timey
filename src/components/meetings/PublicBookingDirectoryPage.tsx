import { useMemo } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { alpha } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { tables } from '../../module_bindings';
import type {
    MeetingEventType as DbMeetingEventType,
    MeetingPublicProfile as DbMeetingPublicProfile,
    Organization as DbOrganization,
    User as DbUser,
} from '../../module_bindings/types';
import { chatColors } from '../../theme/chatColors';
import { meetingsRadius } from './MeetingsUI';

type PublicBookingDirectoryPageProps = {
    handle: string;
};

function normalizeHandle(value: string): string {
    return decodeURIComponent(value || '').trim().toLowerCase();
}

const pageBackground = `
    radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 0 30%),
    linear-gradient(180deg, #050505 0%, #000000 100%)
`;

const pageShellSx = {
    minHeight: '100vh',
    px: { xs: 2, md: 3 },
    py: { xs: 3, md: 5 },
    bgcolor: chatColors.pageBg,
    backgroundImage: pageBackground,
};

const panelBorder = `1px solid ${alpha(chatColors.textPrimary, 0.08)}`;
const panelShadow = '0 20px 56px rgba(0, 0, 0, 0.36)';
const panelSx = {
    borderRadius: meetingsRadius.panel,
    border: panelBorder,
    bgcolor: alpha(chatColors.panelBg, 0.94),
    boxShadow: panelShadow,
    backdropFilter: 'blur(14px)',
};

function navigateToEvent(
    navigate: ReturnType<typeof useNavigate>,
    profile: DbMeetingPublicProfile,
    eventType: DbMeetingEventType
) {
    return navigate({
        to: '/u/$handle/$eventTypeSlug',
        params: {
            handle: profile.handle,
            eventTypeSlug: eventType.slug,
        },
    });
}

export function PublicBookingDirectoryPage({ handle }: PublicBookingDirectoryPageProps) {
    const navigate = useNavigate();
    const [allProfiles] = useSpacetimeDBQuery(tables.meeting_public_profile);
    const [allEventTypes] = useSpacetimeDBQuery(tables.meeting_event_type);
    const [allUsers] = useSpacetimeDBQuery(tables.user);
    const [allOrganizations] = useSpacetimeDBQuery(tables.organization);

    const profiles = (allProfiles || []) as DbMeetingPublicProfile[];
    const eventTypes = (allEventTypes || []) as DbMeetingEventType[];
    const users = (allUsers || []) as DbUser[];
    const organizations = (allOrganizations || []) as DbOrganization[];
    const normalizedHandle = normalizeHandle(handle);

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

    const activeEventTypes = useMemo(() => {
        if (!profile) return [];
        return eventTypes
            .filter((eventType) =>
                eventType.orgId === profile.orgId &&
                eventType.ownerUserId === profile.userId &&
                eventType.isActive
            )
            .sort((a, b) => Number(a.durationMin) - Number(b.durationMin));
    }, [eventTypes, profile]);

    const isLoading = allProfiles == null || allEventTypes == null || allUsers == null || allOrganizations == null;
    const hostName = owner?.name || profile?.handle || handle;
    const hostInitial = hostName.trim().charAt(0).toUpperCase();

    if (isLoading) {
        return (
            <Box sx={{ ...pageShellSx, display: 'grid', placeItems: 'center' }}>
                <CircularProgress sx={{ color: chatColors.textPrimary }} />
            </Box>
        );
    }

    if (!profile || !profile.bookingEnabled) {
        return (
            <Box sx={{ ...pageShellSx, display: 'grid', placeItems: 'center' }}>
                <Paper sx={{ ...panelSx, p: 3, maxWidth: 560, width: '100%' }}>
                    <Stack spacing={1.3}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: chatColors.textPrimary }}>
                            Booking page unavailable
                        </Typography>
                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.92rem', lineHeight: 1.65 }}>
                            This public meeting profile is not published or no longer exists.
                        </Typography>
                        <Box>
                            <Button
                                onClick={() => void navigate({ to: '/' })}
                                variant="contained"
                                sx={{
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    px: 2.1,
                                    borderRadius: meetingsRadius.control,
                                    bgcolor: chatColors.actionBg,
                                    color: chatColors.actionText,
                                    '&:hover': { bgcolor: chatColors.actionBgHover },
                                }}
                            >
                                Go to Timey
                            </Button>
                        </Box>
                    </Stack>
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={pageShellSx}>
            <Box sx={{ maxWidth: 1040, mx: 'auto' }}>
                <Stack spacing={2.2} alignItems="center">
                    <Chip
                        label="Timey scheduling"
                        sx={{
                            mt: 1,
                            color: chatColors.textSecondary,
                            bgcolor: alpha(chatColors.textPrimary, 0.035),
                            border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            fontWeight: 800,
                            fontSize: '0.66rem',
                            borderRadius: meetingsRadius.badge,
                        }}
                    />

                    <Paper sx={{ ...panelSx, width: '100%', overflow: 'hidden' }}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' },
                            }}
                        >
                            <Box
                                sx={{
                                    p: { xs: 2.4, md: 3.2 },
                                    borderRight: { md: panelBorder },
                                    borderBottom: { xs: panelBorder, md: 'none' },
                                    background: `
                                        linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)
                                    `,
                                }}
                            >
                                <Stack spacing={2.4} alignItems={{ xs: 'center', md: 'flex-start' }}>
                                    <Avatar
                                        sx={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: meetingsRadius.card,
                                            fontWeight: 800,
                                            fontSize: '1.8rem',
                                            color: chatColors.actionText,
                                            bgcolor: chatColors.actionBg,
                                            boxShadow: 'none',
                                        }}
                                    >
                                        {hostInitial}
                                    </Avatar>

                                    <Stack spacing={1} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                            Meet with
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: { xs: '1.9rem', md: '2.25rem' }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.03em' }}>
                                            {hostName}
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.97rem', lineHeight: 1.72, maxWidth: 340 }}>
                                            {profile.headline || 'Choose a meeting type and pick the time that works best for you.'}
                                        </Typography>
                                    </Stack>

                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'center', md: 'flex-start' }}>
                                        <Chip
                                            label={organization?.name || 'Workspace'}
                                            sx={{
                                                height: 30,
                                                color: chatColors.textPrimary,
                                                bgcolor: alpha(chatColors.textPrimary, 0.05),
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                fontWeight: 700,
                                                borderRadius: meetingsRadius.badge,
                                            }}
                                        />
                                        <Chip
                                            icon={<CalendarMonthRoundedIcon sx={{ fontSize: 15, color: `${chatColors.textSecondary} !important` }} />}
                                            label={`${activeEventTypes.length} ${activeEventTypes.length === 1 ? 'meeting type' : 'meeting types'}`}
                                            sx={{
                                                height: 30,
                                                color: chatColors.textSecondary,
                                                bgcolor: alpha(chatColors.textPrimary, 0.04),
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.06)}`,
                                                fontWeight: 700,
                                                borderRadius: meetingsRadius.badge,
                                            }}
                                        />
                                    </Stack>

                                    <Stack spacing={1.05} sx={{ width: '100%' }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                px: 1.5,
                                                py: 1.2,
                                                borderRadius: meetingsRadius.control,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.07)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.03),
                                            }}
                                        >
                                            <PublicRoundedIcon sx={{ color: chatColors.textMuted, fontSize: 17 }} />
                                            <Stack spacing={0.15}>
                                                <Typography sx={{ color: chatColors.textMuted, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                    Time zone
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.83rem', fontWeight: 600 }}>
                                                    {profile.timezone}
                                                </Typography>
                                            </Stack>
                                        </Box>

                                        <Box
                                            sx={{
                                                px: 1.5,
                                                py: 1.3,
                                                borderRadius: meetingsRadius.control,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.07)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.025),
                                            }}
                                        >
                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                Booking flow
                                            </Typography>
                                            <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.84rem', lineHeight: 1.7, mt: 0.7 }}>
                                                Select a session below, choose an open time, and confirm your details. The booking goes straight to the host inside Timey.
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </Box>

                            <Box sx={{ p: { xs: 2, md: 3.2 } }}>
                                <Stack spacing={2.2}>
                                    <Stack spacing={0.9} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                            Booking directory
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: { xs: '1.35rem', md: '1.65rem' }, fontWeight: 850, letterSpacing: '-0.02em' }}>
                                            Choose a meeting type
                                        </Typography>
                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.92rem', lineHeight: 1.7, maxWidth: 560 }}>
                                            Each option opens the same scheduling flow with its own duration, context, and booking rules.
                                        </Typography>
                                    </Stack>

                                    {activeEventTypes.length === 0 ? (
                                        <Paper
                                            sx={{
                                                borderRadius: meetingsRadius.card,
                                                border: `1px dashed ${alpha(chatColors.textPrimary, 0.12)}`,
                                                bgcolor: alpha(chatColors.textPrimary, 0.025),
                                                boxShadow: 'none',
                                                p: 3,
                                            }}
                                        >
                                            <Stack spacing={0.7} alignItems={{ xs: 'center', md: 'flex-start' }}>
                                                <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.96rem', fontWeight: 800 }}>
                                                    No meeting types are available right now
                                                </Typography>
                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.86rem', lineHeight: 1.65, maxWidth: 480 }}>
                                                    Check back later or contact the host directly for a custom time.
                                                </Typography>
                                            </Stack>
                                        </Paper>
                                    ) : (
                                        <Stack spacing={1.2}>
                                            {activeEventTypes.map((eventType) => (
                                                <Paper
                                                    key={String(eventType.id)}
                                                    onClick={() => void navigateToEvent(navigate, profile, eventType)}
                                                    sx={{
                                                        p: { xs: 1.5, md: 1.7 },
                                                        borderRadius: meetingsRadius.card,
                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                        bgcolor: alpha(chatColors.textPrimary, 0.025),
                                                        boxShadow: 'none',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                                                        '&:hover': {
                                                            transform: 'translateY(-1px)',
                                                            borderColor: alpha(chatColors.textPrimary, 0.18),
                                                            bgcolor: alpha(chatColors.textPrimary, 0.04),
                                                            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
                                                        },
                                                    }}
                                                >
                                                    <Stack spacing={1.45}>
                                                        <Stack
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1.2}
                                                            justifyContent="space-between"
                                                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                                                        >
                                                            <Stack spacing={0.55}>
                                                                <Typography sx={{ color: chatColors.textPrimary, fontWeight: 800, fontSize: '1.02rem' }}>
                                                                    {eventType.title}
                                                                </Typography>
                                                                <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.84rem', lineHeight: 1.65 }}>
                                                                    {eventType.description || 'A focused meeting with the host.'}
                                                                </Typography>
                                                            </Stack>

                                                            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                                                <Chip
                                                                    icon={<AccessTimeRoundedIcon sx={{ fontSize: 15, color: `${chatColors.textSecondary} !important` }} />}
                                                                    label={`${eventType.durationMin.toString()} min`}
                                                                    sx={{
                                                                        color: chatColors.textPrimary,
                                                                        bgcolor: alpha(chatColors.textPrimary, 0.06),
                                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.08)}`,
                                                                        fontWeight: 700,
                                                                        borderRadius: meetingsRadius.badge,
                                                                    }}
                                                                />
                                                                <Chip
                                                                    label={eventType.visibility === 'public' ? 'Public booking' : 'Channel linked'}
                                                                    sx={{
                                                                        color: chatColors.textSecondary,
                                                                        bgcolor: alpha(chatColors.textPrimary, 0.04),
                                                                        border: `1px solid ${alpha(chatColors.textPrimary, 0.06)}`,
                                                                        fontWeight: 700,
                                                                        borderRadius: meetingsRadius.badge,
                                                                    }}
                                                                />
                                                            </Stack>
                                                        </Stack>

                                                        <Stack
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1.1}
                                                            justifyContent="space-between"
                                                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                                                        >
                                                            <Typography sx={{ color: chatColors.textMuted, fontSize: '0.74rem', lineHeight: 1.55 }}>
                                                                Continue to view availability and confirm a time.
                                                            </Typography>
                                                            <Button
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    void navigateToEvent(navigate, profile, eventType);
                                                                }}
                                                                variant="contained"
                                                                endIcon={<ArrowOutwardRoundedIcon />}
                                                                sx={{
                                                                    textTransform: 'none',
                                                                    fontWeight: 800,
                                                                    px: 1.8,
                                                                    borderRadius: meetingsRadius.control,
                                                                    bgcolor: chatColors.actionBg,
                                                                    color: chatColors.actionText,
                                                                    '&:hover': { bgcolor: chatColors.actionBgHover },
                                                                }}
                                                            >
                                                                Select
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </Box>
                        </Box>
                    </Paper>
                </Stack>
            </Box>
        </Box>
    );
}
