import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AddReactionRoundedIcon from '@mui/icons-material/AddReactionRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';

interface MessageInputProps {
    onSend: (content: string) => Promise<void> | void;
    channelId: bigint | null;
    disabled?: boolean;
    channelName?: string;
    onTypingChange?: (typing: boolean) => void;
    contextHint?: string;
    draftScope?: string;
}

const QUICK_EMOJIS = ['🔥', '👍', '✅', '🎉', '👀'];
const MAX_MESSAGE_LENGTH = 2000;

export function MessageInput({
    onSend,
    channelId,
    disabled = false,
    channelName = 'channel',
    onTypingChange,
    contextHint,
    draftScope = 'main',
}: MessageInputProps) {
    const [value, setValue] = useState('');
    const [sending, setSending] = useState(false);

    const draftStorageKey = useMemo(() => {
        return channelId === null ? null : `timey-chat-draft-${String(channelId)}-${draftScope}`;
    }, [channelId, draftScope]);

    useEffect(() => {
        if (draftStorageKey == null || typeof window === 'undefined') {
            setValue('');
            return;
        }
        const saved = window.localStorage.getItem(draftStorageKey);
        setValue(saved ?? '');
    }, [draftStorageKey]);

    useEffect(() => {
        if (draftStorageKey == null || typeof window === 'undefined') return;
        if (value.trim()) {
            window.localStorage.setItem(draftStorageKey, value);
        } else {
            window.localStorage.removeItem(draftStorageKey);
        }
    }, [draftStorageKey, value]);

    useEffect(() => {
        onTypingChange?.(value.trim().length > 0);
    }, [onTypingChange, value]);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;
        setSending(true);
        try {
            await onSend(trimmed);
            setValue('');
            if (draftStorageKey && typeof window !== 'undefined') {
                window.localStorage.removeItem(draftStorageKey);
            }
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
        if (e.key === 'Escape') {
            setValue('');
        }
    };

    return (
        <Box
            sx={{
                px: 3,
                py: 1.5,
                borderTop: '1px solid #1a1a1a',
            }}
        >
            <Box
                sx={{
                    bgcolor: '#111',
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    border: '1px solid #222',
                    '&:focus-within': { borderColor: '#5865F2' },
                    transition: 'border-color 0.2s',
                }}
            >
                <Tooltip title="Mention someone">
                    <IconButton
                        size="small"
                        onClick={() => setValue((curr) => `${curr}@`)}
                        sx={{ color: '#666', mt: 0.2 }}
                    >
                        <AlternateEmailRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <InputBase
                    placeholder={`Message #${channelName}...`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    multiline
                    maxRows={5}
                    fullWidth
                    disabled={disabled}
                    sx={{
                        color: '#fff',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        '& textarea': { padding: 0 },
                    }}
                />
                <Stack direction="row" spacing={0.4} alignItems="center" sx={{ pb: 0.1 }}>
                    {QUICK_EMOJIS.map((emoji) => (
                        <IconButton
                            key={emoji}
                            size="small"
                            onClick={() => setValue((curr) => `${curr}${emoji}`)}
                            sx={{
                                color: '#777',
                                width: 22,
                                height: 22,
                                fontSize: '0.8rem',
                                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                            }}
                        >
                            {emoji}
                        </IconButton>
                    ))}
                    <IconButton size="small" disabled sx={{ color: '#444', width: 22, height: 22 }}>
                        <AddReactionRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Stack>
                <IconButton
                    onClick={() => void handleSend()}
                    disabled={disabled || sending || !value.trim() || value.trim().length > MAX_MESSAGE_LENGTH}
                    sx={{
                        color: value.trim() ? '#fff' : '#555',
                        bgcolor: value.trim() ? '#5865F2' : 'transparent',
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                            bgcolor: value.trim() ? '#4c59de' : 'rgba(255,255,255,0.05)',
                        },
                        '&.Mui-disabled': { color: '#333' },
                    }}
                >
                    <SendRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            {contextHint && (
                <Typography variant="caption" sx={{ color: '#76829f', fontSize: '0.68rem', display: 'block', mt: 0.5 }}>
                    {contextHint}
                </Typography>
            )}
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75, px: 0.25 }}>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.67rem' }}>
                    Press Enter to send, Shift+Enter for newline
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: value.length > MAX_MESSAGE_LENGTH ? '#f85149' : '#666',
                        fontSize: '0.67rem',
                    }}
                >
                    {value.length}/{MAX_MESSAGE_LENGTH}
                </Typography>
            </Stack>
        </Box>
    );
}
