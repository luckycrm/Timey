import { useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

interface MessageInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
    channelName?: string;
}

export function MessageInput({ onSend, disabled = false, channelName = 'channel' }: MessageInputProps) {
    const [value, setValue] = useState('');

    const handleSend = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
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
                    '&:focus-within': { borderColor: '#444' },
                    transition: 'border-color 0.2s',
                }}
            >
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
                <IconButton
                    onClick={handleSend}
                    disabled={disabled || !value.trim()}
                    sx={{
                        color: value.trim() ? '#fff' : '#555',
                        bgcolor: value.trim() ? '#0070f3' : 'transparent',
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                            bgcolor: value.trim() ? '#0060d3' : 'rgba(255,255,255,0.05)',
                        },
                        '&.Mui-disabled': { color: '#333' },
                    }}
                >
                    <SendRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
        </Box>
    );
}
