import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PictureInPictureAltRoundedIcon from '@mui/icons-material/PictureInPictureAltRounded';
import { DyteMeeting } from '@dytesdk/react-ui-kit';
import { useDyteClient } from '@dytesdk/react-web-core';

interface DyteCallInlineProps {
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

function findVideoElement(root: ParentNode): HTMLVideoElement | null {
    const direct = root.querySelector('video');
    if (direct) return direct as HTMLVideoElement;

    const elements = Array.from(root.querySelectorAll('*')) as HTMLElement[];
    for (const element of elements) {
        if (element.shadowRoot) {
            const nested = findVideoElement(element.shadowRoot);
            if (nested) return nested;
        }
    }

    return null;
}

export function DyteCallInline({ authToken, title, onClose }: DyteCallInlineProps) {
    const [meeting, initMeeting] = useDyteClient({ resetOnLeave: true });
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [meetingState, setMeetingState] = useState<string>('idle');
    const [isPictureInPicture, setIsPictureInPicture] = useState(false);
    const meetingHostRef = useRef<HTMLDivElement | null>(null);
    const pictureInPictureSupported = useMemo(() => {
        if (typeof document === 'undefined') return false;
        return !!document.pictureInPictureEnabled;
    }, []);

    useEffect(() => {
        if (!authToken) return;

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
    }, [authToken, initMeeting]);

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

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const syncPipState = () => {
            setIsPictureInPicture(Boolean(document.pictureInPictureElement));
        };

        syncPipState();
        document.addEventListener('enterpictureinpicture', syncPipState as EventListener);
        document.addEventListener('leavepictureinpicture', syncPipState as EventListener);
        return () => {
            document.removeEventListener('enterpictureinpicture', syncPipState as EventListener);
            document.removeEventListener('leavepictureinpicture', syncPipState as EventListener);
        };
    }, []);

    const togglePictureInPicture = useCallback(async () => {
        if (typeof document === 'undefined') return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                setIsPictureInPicture(false);
                return;
            }

            const host = meetingHostRef.current;
            if (!host) return;

            const video = findVideoElement(host);
            if (!video || typeof video.requestPictureInPicture !== 'function') return;

            await video.requestPictureInPicture();
            setIsPictureInPicture(true);
        } catch {
            // Best-effort PiP toggle.
        }
    }, []);

    const handleClose = () => {
        if (meeting) {
            void meeting.leave().catch(() => {
                // Ignore close-time leave errors.
            });
        }
        onClose();
    };

    if (!authToken) return null;

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                bgcolor: '#000000',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
            }}
        >
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
                <Typography sx={{ fontSize: '0.65rem', color: '#9aa0aa' }}>{formatMeetingStateLabel(meetingState)}</Typography>
            </Stack>

            <Stack direction="row" spacing={0.7} sx={{ position: 'absolute', bottom: 10, right: 10, zIndex: 6 }}>
                <Tooltip title={isPictureInPicture ? 'Exit PiP' : 'Picture-in-picture'}>
                    <span>
                        <IconButton
                            onClick={() => {
                                void togglePictureInPicture();
                            }}
                            disabled={!pictureInPictureSupported}
                            sx={{
                                color: isPictureInPicture ? '#ffffff' : '#d0d0d0',
                                borderRadius: 1.5,
                                bgcolor: 'rgba(0,0,0,0.48)',
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.68)', color: '#ffffff' },
                                '&.Mui-disabled': { color: '#676767', bgcolor: 'rgba(0,0,0,0.34)' },
                            }}
                        >
                            <PictureInPictureAltRoundedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </span>
                </Tooltip>

                <IconButton
                    onClick={handleClose}
                    sx={{
                        color: '#d0d0d0',
                        borderRadius: 1.5,
                        bgcolor: 'rgba(0,0,0,0.48)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.68)', color: '#ffffff' },
                    }}
                >
                    <CloseRoundedIcon />
                </IconButton>
            </Stack>

            {isJoining && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2 }}>
                    <Stack spacing={1} alignItems="center">
                        <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                        <Typography sx={{ color: '#9d9d9d', fontSize: '0.75rem' }}>Joining call...</Typography>
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
                    ref={meetingHostRef}
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
                        key={authToken}
                        meeting={meeting}
                        showSetupScreen
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
    );
}
