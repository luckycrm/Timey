import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { DyteMeeting } from '@dytesdk/react-ui-kit';
import { useDyteClient } from '@dytesdk/react-web-core';

interface DyteCallDialogProps {
    open: boolean;
    authToken: string | null;
    title: string;
    onClose: () => void;
}

function formatMeetingStateLabel(state: string): string {
    const normalized = state.trim().toLowerCase();
    if (!normalized) return 'Ready';
    if (normalized === 'idle') return 'Ready';
    if (normalized === 'initializing') return 'Initializing';
    if (normalized === 'connecting') return 'Connecting';
    if (normalized.includes('setup')) return 'Setup';
    if (normalized.includes('joined') || normalized.includes('connected') || normalized.includes('meeting')) return 'In meeting';
    if (normalized.includes('left') || normalized.includes('ended')) return 'Ended';
    if (normalized === 'error') return 'Connection issue';
    return normalized
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function DyteCallDialog({ open, authToken, title, onClose }: DyteCallDialogProps) {
    const [meeting, initMeeting] = useDyteClient({ resetOnLeave: true });
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [meetingState, setMeetingState] = useState<string>('idle');

    useEffect(() => {
        if (!open || !authToken) return;

        let cancelled = false;
        setIsJoining(true);
        setJoinError(null);
        setMeetingState('initializing');

        void initMeeting({
            authToken,
            defaults: {
                audio: true,
                video: true,
            },
        })
            .then(() => {
                if (cancelled) return;
                setMeetingState('connecting');
            })
            .catch((error) => {
                if (cancelled) return;
                setJoinError(error instanceof Error ? error.message : 'Could not join call.');
                setMeetingState('error');
            })
            .finally(() => {
                if (!cancelled) setIsJoining(false);
            });

        return () => {
            cancelled = true;
        };
    }, [authToken, initMeeting, open]);

    useEffect(() => {
        if (!meeting) return;
        setJoinError(null);
        if (meetingState === 'initializing') {
            setMeetingState('connected');
        }
    }, [meeting, meetingState]);

    useEffect(() => {
        if (!meeting) return;

        const handleRoomLeft = () => {
            onClose();
        };

        meeting.self.on('roomLeft', handleRoomLeft);
        return () => {
            meeting.self.removeListener('roomLeft', handleRoomLeft);
        };
    }, [meeting, onClose]);

    const handleClose = () => {
        if (meeting) {
            void meeting.leave().catch(() => {
                // Ignore close-time leave errors.
            });
        }
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullScreen
            PaperProps={{
                sx: {
                    bgcolor: '#050505',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    p: 0,
                    m: 0,
                    overflow: 'hidden',
                },
            }}
        >
            <Box sx={{ flexGrow: 1, minHeight: 0, position: 'relative', bgcolor: '#000000' }}>
                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 5,
                        px: 1,
                        py: 0.55,
                        borderRadius: 1.2,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(8px)',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff' }}>
                        {title || 'Video Meeting'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#9aa0aa' }}>
                        {formatMeetingStateLabel(meetingState)}
                    </Typography>
                </Stack>

                <IconButton
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        zIndex: 6,
                        color: '#d0d0d0',
                        borderRadius: 1.5,
                        bgcolor: 'rgba(0,0,0,0.48)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.68)', color: '#ffffff' },
                    }}
                >
                    <CloseRoundedIcon />
                </IconButton>

                {isJoining && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2 }}>
                        <Stack spacing={1} alignItems="center">
                            <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                            <Typography sx={{ color: '#9d9d9d', fontSize: '0.75rem' }}>
                                Joining call...
                            </Typography>
                        </Stack>
                    </Box>
                )}

                {joinError && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', px: 3 }}>
                        <Typography sx={{ color: '#ff8d8d', fontSize: '0.82rem', textAlign: 'center' }}>
                            {joinError}
                        </Typography>
                    </Box>
                )}

                {meeting && !joinError && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            minWidth: 0,
                            minHeight: 0,
                            overflow: 'hidden',
                            '& dyte-meeting': {
                                display: 'flex',
                                width: '100%',
                                height: '100%',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                minHeight: 0,
                                minWidth: 0,
                                position: 'relative !important',
                                inset: '0 !important',
                            },
                        }}
                    >
                        <DyteMeeting
                            key={authToken || 'dyte-call'}
                            meeting={meeting}
                            showSetupScreen
                            leaveOnUnmount
                            mode="fill"
                            onDyteStatesUpdate={(event) => {
                                const nextState = (event as any)?.detail?.meeting;
                                if (typeof nextState === 'string') {
                                    setMeetingState(nextState);
                                }
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Dialog>
    );
}
