import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import { Link, useLocation } from '@tanstack/react-router';
import { meetingsPanelSx, meetingsRadius } from './MeetingsUI';

export type MeetingsMode = 'channel' | 'public';

interface MeetingsSidebarProps {
    mode?: MeetingsMode;
    onModeChange?: (mode: MeetingsMode) => void;
    upcomingCount?: number;
    liveCount?: number;
    publicCount?: number;
}

export function MeetingsSidebar({
    mode,
    onModeChange,
    upcomingCount = 0,
    liveCount = 0,
    publicCount = 0,
}: MeetingsSidebarProps) {
    const location = useLocation();
    const resolvedMode: MeetingsMode = mode || (location.href.includes('type=public') ? 'public' : 'channel');

    const NavButton = ({ to, label, icon: Icon }: { to: '/meetings' | '/meetings/calendar' | '/meetings/requests' | '/meetings/activity' | '/meetings/settings'; label: string; icon: any }) => {
        const active = location.pathname === to;
        return (
            <Link to={to} style={{ textDecoration: 'none' }}>
                <Button
                    fullWidth
                    startIcon={<Icon sx={{ fontSize: 16 }} />}
                    sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        borderRadius: meetingsRadius.control,
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        py: 0.85,
                        color: active ? '#ffffff' : '#c3cad6',
                        bgcolor: active ? 'rgba(114,138,255,0.18)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${active ? 'rgba(114,138,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                        '&:hover': {
                            bgcolor: active ? 'rgba(114,138,255,0.24)' : 'rgba(255,255,255,0.05)',
                            color: '#ffffff',
                        },
                    }}
                >
                    {label}
                </Button>
            </Link>
        );
    };

    const MeetingTypeButton = ({
        value,
        label,
        icon: Icon,
    }: {
        value: MeetingsMode;
        label: string;
        icon: any;
    }) => {
        const active = resolvedMode === value;
        const buttonSx = {
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: meetingsRadius.control,
            justifyContent: 'flex-start',
            bgcolor: active ? '#ffffff' : 'rgba(255,255,255,0.02)',
            color: active ? '#000000' : '#ffffff',
            border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': {
                bgcolor: active ? '#ffffff' : 'rgba(255,255,255,0.06)',
            },
        };

        if (onModeChange) {
            return (
                <Button
                    onClick={() => onModeChange(value)}
                    startIcon={<Icon sx={{ fontSize: 16 }} />}
                    fullWidth
                    sx={buttonSx}
                >
                    {label}
                </Button>
            );
        }

        return (
            <Link to="/meetings" search={{ type: value } as any} style={{ textDecoration: 'none' }}>
                <Button
                    startIcon={<Icon sx={{ fontSize: 16 }} />}
                    fullWidth
                    sx={buttonSx}
                >
                    {label}
                </Button>
            </Link>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Paper sx={{ ...meetingsPanelSx, p: 1.1, mb: 1.3 }}>
                <Typography sx={{ color: '#8f98a8', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.9 }}>
                    Meeting Type
                </Typography>
                <Stack spacing={1.1}>
                    <MeetingTypeButton value="channel" label="Team Meeting" icon={TagRoundedIcon} />
                    <MeetingTypeButton value="public" label="Guest Meeting" icon={PublicRoundedIcon} />
                </Stack>
            </Paper>

            <Paper sx={{ ...meetingsPanelSx, p: 1.1, mb: 1.3 }}>
                <Typography sx={{ color: '#8f98a8', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.9 }}>
                    Navigation
                </Typography>
                <Stack spacing={0.75}>
                    <NavButton to="/meetings" label="Meeting Home" icon={EventAvailableRoundedIcon} />
                    <NavButton to="/meetings/calendar" label="Calendar View" icon={CalendarMonthRoundedIcon} />
                    <NavButton to="/meetings/requests" label="Booking Requests" icon={ChecklistRoundedIcon} />
                    <NavButton to="/meetings/activity" label="Activity Log" icon={TimelineRoundedIcon} />
                    <NavButton to="/meetings/settings" label="Booking Setup" icon={SettingsRoundedIcon} />
                </Stack>
            </Paper>

            <Paper sx={{ ...meetingsPanelSx, p: 1.1 }}>
                <Typography sx={{ color: '#8f98a8', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.9 }}>
                    Overview
                </Typography>
                <Stack spacing={0.8}>
                    <Paper sx={{ bgcolor: '#050505', border: '1px solid rgba(255,255,255,0.07)', p: 1.1, borderRadius: meetingsRadius.card }}>
                        <Typography sx={{ color: '#8d97a7', fontSize: '0.68rem' }}>Upcoming</Typography>
                        <Typography sx={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 800 }}>{upcomingCount}</Typography>
                    </Paper>
                    <Paper sx={{ bgcolor: '#050505', border: '1px solid rgba(255,255,255,0.07)', p: 1.1, borderRadius: meetingsRadius.card }}>
                        <Typography sx={{ color: '#8d97a7', fontSize: '0.68rem' }}>Live now</Typography>
                        <Typography sx={{ color: '#9cf0bf', fontSize: '1.05rem', fontWeight: 800 }}>{liveCount}</Typography>
                    </Paper>
                    <Paper sx={{ bgcolor: '#050505', border: '1px solid rgba(255,255,255,0.07)', p: 1.1, borderRadius: meetingsRadius.card }}>
                        <Typography sx={{ color: '#8d97a7', fontSize: '0.68rem' }}>Guest links</Typography>
                        <Typography sx={{ color: '#b8ceff', fontSize: '1.05rem', fontWeight: 800 }}>{publicCount}</Typography>
                    </Paper>
                </Stack>
            </Paper>
        </Box>
    );
}
