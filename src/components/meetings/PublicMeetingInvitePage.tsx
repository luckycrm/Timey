import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { inspectPublicMeetingInvite, joinPublicMeetingInviteAccess } from '../../server/dyte';
import { DyteCallInline } from '../calls/DyteCallInline';
import { appRadii } from '../../theme/radii';

type PublicMeetingInvitePageProps = {
    inviteToken: string;
};

export function PublicMeetingInvitePage({ inviteToken }: PublicMeetingInvitePageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [meetingTitle, setMeetingTitle] = useState('Guest meeting');
    const [scheduledAt, setScheduledAt] = useState<number | null>(null);
    const [guestName, setGuestName] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setInviteError(null);

        void inspectPublicMeetingInvite({
            data: { token: inviteToken } as any,
        })
            .then((result) => {
                if (cancelled) return;
                if (!result.success) {
                    setInviteError(result.error || 'Invite is not available.');
                    return;
                }
                setMeetingTitle(result.title || 'Guest meeting');
                setScheduledAt(typeof result.scheduledAt === 'number' ? result.scheduledAt : null);
            })
            .catch((error) => {
                if (cancelled) return;
                setInviteError(error instanceof Error ? error.message : 'Invite is not available.');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [inviteToken]);

    const handleJoin = async () => {
        if (guestName.trim().length < 2) {
            setJoinError('Enter your name to join the meeting.');
            return;
        }

        setJoinError(null);
        setIsJoining(true);
        try {
            const result = await joinPublicMeetingInviteAccess({
                data: {
                    token: inviteToken,
                    guestName: guestName.trim(),
                } as any,
            });

            if (!result.success || !result.authToken) {
                setJoinError(result.error || 'Could not join meeting.');
                return;
            }

            setMeetingTitle(result.title || meetingTitle);
            setAuthToken(result.authToken);
        } catch (error) {
            setJoinError(error instanceof Error ? error.message : 'Could not join meeting.');
        } finally {
            setIsJoining(false);
        }
    };

    if (authToken) {
        return (
            <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#000000' }}>
                <DyteCallInline
                    authToken={authToken}
                    title={meetingTitle}
                    onClose={() => setAuthToken(null)}
                />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 3, bgcolor: '#000000' }}>
            <Paper
                sx={{
                    width: '100%',
                    maxWidth: 520,
                    p: 2.2,
                    borderRadius: appRadii.panel,
                    bgcolor: '#050505',
                    border: '1px solid #1a1a1a',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
                }}
            >
                {isLoading ? (
                    <Stack spacing={1.2} alignItems="center" sx={{ py: 4 }}>
                        <CircularProgress sx={{ color: '#ffffff' }} size={24} />
                        <Typography sx={{ color: '#858585', fontSize: '0.82rem' }}>
                            Opening invite...
                        </Typography>
                    </Stack>
                ) : inviteError ? (
                    <Stack spacing={1.1}>
                        <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                            Invite unavailable
                        </Typography>
                        <Typography sx={{ color: '#8f98a8', fontSize: '0.82rem' }}>
                            {inviteError}
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1.5}>
                        <Stack spacing={0.55}>
                            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>
                                {meetingTitle}
                            </Typography>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                                <EventAvailableRoundedIcon sx={{ color: '#b8c0ce', fontSize: 16 }} />
                                <Typography sx={{ color: '#8f98a8', fontSize: '0.8rem' }}>
                                    {scheduledAt
                                        ? new Date(scheduledAt).toLocaleString([], {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : 'Scheduled meeting'}
                                </Typography>
                            </Stack>
                            <Typography sx={{ color: '#b8c0ce', fontSize: '0.8rem' }}>
                                This guest link is for people outside the workspace. Enter your name to join the meeting directly.
                            </Typography>
                        </Stack>

                        <TextField
                            label="Your name"
                            value={guestName}
                            onChange={(event) => setGuestName(event.target.value)}
                            placeholder="Jane Doe"
                            fullWidth
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': {
                                    color: '#ffffff',
                                    bgcolor: '#111111',
                                    borderRadius: appRadii.control,
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    color: '#666666',
                                    opacity: 1,
                                },
                                '& .MuiInputLabel-root': { color: '#858585' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#ffffff' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1a1a1a' },
                                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#333333',
                                },
                                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#ffffff',
                                },
                            }}
                        />

                        {joinError ? (
                            <Typography sx={{ color: '#f2a9b3', fontSize: '0.78rem' }}>
                                {joinError}
                            </Typography>
                        ) : null}

                        <Button
                            onClick={() => void handleJoin()}
                            disabled={isJoining}
                            startIcon={<VideocamRoundedIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 800,
                                borderRadius: appRadii.control,
                                minHeight: 40,
                                bgcolor: '#ffffff',
                                color: '#000000',
                                '&:hover': { bgcolor: '#e0e0e0' },
                                '&.Mui-disabled': {
                                    bgcolor: '#333333',
                                    color: '#666666',
                                },
                            }}
                        >
                            {isJoining ? 'Joining...' : 'Join meeting'}
                        </Button>
                    </Stack>
                )}
            </Paper>
        </Box>
    );
}
