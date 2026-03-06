import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AddReactionRoundedIcon from '@mui/icons-material/AddReactionRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import { chatColors } from '../../theme/chatColors';

interface MessageInputProps {
    onSend: (content: string) => Promise<void> | void;
    channelId: bigint | null;
    disabled?: boolean;
    channelName?: string;
    mentionUsers?: Array<{ id: bigint; name: string }>;
    onTypingChange?: (typing: boolean) => void;
    contextHint?: string;
    draftScope?: string;
    focusSignal?: number;
}

const QUICK_EMOJIS = ['🔥', '👍', '✅', '🎉', '👀'];
const MAX_MESSAGE_LENGTH = 2000;
const AVATAR_COLORS = ['#1a1a1a', '#222222', '#2a2a2a', '#333333', '#444444', '#555555'];

export function MessageInput({
    onSend,
    channelId,
    disabled = false,
    channelName = 'channel',
    mentionUsers = [],
    onTypingChange,
    contextHint,
    draftScope = 'main',
    focusSignal,
}: MessageInputProps) {
    const [value, setValue] = useState('');
    const [sending, setSending] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
    const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionSelectionIndex, setMentionSelectionIndex] = useState(0);
    const [cursorIndex, setCursorIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

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

    useEffect(() => {
        if (focusSignal == null) return;
        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    }, [focusSignal]);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;
        setSending(true);
        try {
            await onSend(trimmed);
            setValue('');
            setMentionStartIndex(null);
            setMentionQuery('');
            setMentionSelectionIndex(0);
            if (draftStorageKey && typeof window !== 'undefined') {
                window.localStorage.removeItem(draftStorageKey);
            }
        } finally {
            setSending(false);
        }
    };

    const updateMentionContext = (nextValue: string, nextCursorIndex: number) => {
        const beforeCursor = nextValue.slice(0, nextCursorIndex);
        const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);
        if (!match) {
            setMentionStartIndex(null);
            setMentionQuery('');
            setMentionSelectionIndex(0);
            return;
        }
        const query = match[2] || '';
        const atIndex = nextCursorIndex - query.length - 1;
        setMentionStartIndex(atIndex);
        setMentionQuery(query);
        setMentionSelectionIndex(0);
    };

    const normalizedMentionQuery = mentionQuery.trim().toLowerCase();
    const filteredMentionUsers = useMemo(() => {
        const sorted = [...mentionUsers].sort((a, b) => a.name.localeCompare(b.name));
        if (!normalizedMentionQuery) return sorted.slice(0, 8);
        return sorted
            .filter((user) => user.name.toLowerCase().includes(normalizedMentionQuery))
            .slice(0, 8);
    }, [mentionUsers, normalizedMentionQuery]);

    const mentionPickerOpen = mentionStartIndex !== null;
    const normalizedChannelName = channelName.trim() || 'channel';
    const placeholderChannelName =
        normalizedChannelName.length > 22
            ? `${normalizedChannelName.slice(0, 19)}...`
            : normalizedChannelName;
    const messagePlaceholder = `Message #${placeholderChannelName}`;

    const insertMentionUser = (user: { id: bigint; name: string }) => {
        if (mentionStartIndex == null) return;
        const cursor = inputRef.current?.selectionStart ?? cursorIndex;
        const safeHandle = user.name.replace(/\s+/g, '');
        const mentionToken = `@${safeHandle}`;
        const nextValue = `${value.slice(0, mentionStartIndex)}${mentionToken} ${value.slice(cursor)}`;
        const nextCursorIndex = mentionStartIndex + mentionToken.length + 1;

        setValue(nextValue);
        setCursorIndex(nextCursorIndex);
        setMentionStartIndex(null);
        setMentionQuery('');
        setMentionSelectionIndex(0);

        requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(nextCursorIndex, nextCursorIndex);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionPickerOpen && filteredMentionUsers.length > 0 && e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionSelectionIndex((current) => (current + 1) % filteredMentionUsers.length);
            return;
        }
        if (mentionPickerOpen && filteredMentionUsers.length > 0 && e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionSelectionIndex((current) => (current - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
            return;
        }
        if (mentionPickerOpen && filteredMentionUsers.length > 0 && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
            e.preventDefault();
            const target = filteredMentionUsers[mentionSelectionIndex] || filteredMentionUsers[0];
            if (target) {
                insertMentionUser(target);
            }
            return;
        }
        if (mentionPickerOpen && e.key === 'Escape') {
            setMentionStartIndex(null);
            setMentionQuery('');
            setMentionSelectionIndex(0);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
        if (e.key === 'Escape') {
            setValue('');
            setMentionStartIndex(null);
            setMentionQuery('');
            setMentionSelectionIndex(0);
        }
    };

    const openEmojiMenu = (event: MouseEvent<HTMLElement>) => {
        setEmojiAnchorEl(event.currentTarget);
    };

    const closeEmojiMenu = () => {
        setEmojiAnchorEl(null);
    };

    const addEmoji = (emoji: string) => {
        setValue((curr) => {
            if (!curr) return emoji;
            return /\s$/.test(curr) ? `${curr}${emoji}` : `${curr} ${emoji}`;
        });
        closeEmojiMenu();
        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    };

    const getAvatarColor = (name: string) => {
        const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
        return AVATAR_COLORS[colorIndex];
    };

    return (
        <Box
            sx={{
                px: 3,
                py: 1.5,
                borderTop: `1px solid ${chatColors.border}`,
            }}
        >
            <Box
                sx={{
                    bgcolor: chatColors.inputBg,
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    border: `1px solid ${chatColors.borderStrong}`,
                    '&:focus-within': { borderColor: chatColors.borderHover },
                    transition: 'border-color 0.2s',
                }}
            >
                <Tooltip title="Mention someone">
                    <IconButton
                        size="small"
                        onClick={() => {
                            const input = inputRef.current;
                            const start = input?.selectionStart ?? value.length;
                            const end = input?.selectionEnd ?? start;
                            const nextValue = `${value.slice(0, start)}@${value.slice(end)}`;
                            const nextCursorIndex = start + 1;
                            setValue(nextValue);
                            setCursorIndex(nextCursorIndex);
                            updateMentionContext(nextValue, nextCursorIndex);
                            requestAnimationFrame(() => {
                                inputRef.current?.focus();
                                inputRef.current?.setSelectionRange(nextCursorIndex, nextCursorIndex);
                            });
                        }}
                        sx={{ color: chatColors.textMuted, mt: 0.2 }}
                    >
                        <AlternateEmailRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <InputBase
                    placeholder={messagePlaceholder}
                    value={value}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        const nextCursorIndex = e.target.selectionStart ?? nextValue.length;
                        setValue(nextValue);
                        setCursorIndex(nextCursorIndex);
                        updateMentionContext(nextValue, nextCursorIndex);
                    }}
                    onKeyDown={handleKeyDown}
                    onClick={() => {
                        const nextCursorIndex = inputRef.current?.selectionStart ?? value.length;
                        setCursorIndex(nextCursorIndex);
                        updateMentionContext(value, nextCursorIndex);
                    }}
                    inputRef={inputRef}
                    multiline
                    maxRows={5}
                    fullWidth
                    disabled={disabled}
                    sx={{
                        color: chatColors.textPrimary,
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        '& textarea': { padding: 0 },
                        '& textarea::placeholder': {
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        },
                    }}
                />
                <Tooltip title="Add emoji">
                    <IconButton
                        size="small"
                        onClick={openEmojiMenu}
                        sx={{ color: chatColors.textMuted, mt: 0.2 }}
                    >
                        <AddReactionRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <IconButton
                    onClick={() => void handleSend()}
                    disabled={disabled || sending || !value.trim() || value.trim().length > MAX_MESSAGE_LENGTH}
                    sx={{
                        color: value.trim() ? chatColors.actionText : chatColors.textFaint,
                        bgcolor: value.trim() ? chatColors.actionBg : 'transparent',
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                            bgcolor: value.trim() ? chatColors.actionBgHover : chatColors.hover,
                        },
                        '&.Mui-disabled': { color: chatColors.borderStrong },
                    }}
                >
                    <SendRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            {mentionPickerOpen && (
                <Box
                    sx={{
                        mt: 0.55,
                        border: `1px solid ${chatColors.borderStrong}`,
                        borderRadius: 1.5,
                        bgcolor: chatColors.panelBg,
                        overflow: 'hidden',
                    }}
                >
                    {filteredMentionUsers.length > 0 ? (
                        filteredMentionUsers.map((user, index) => {
                            const safeHandle = user.name.replace(/\s+/g, '');
                            const selected = index === mentionSelectionIndex;
                            return (
                                <Box
                                    key={String(user.id)}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        insertMentionUser(user);
                                    }}
                                    sx={{
                                        px: 1.1,
                                        py: 0.65,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        bgcolor: selected ? chatColors.hover : 'transparent',
                                        '&:hover': { bgcolor: chatColors.hover },
                                    }}
                                >
                                    <Stack direction="row" spacing={0.85} alignItems="center">
                                        <Avatar
                                            sx={{
                                                width: 22,
                                                height: 22,
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                color: '#ffffff',
                                                bgcolor: getAvatarColor(user.name),
                                            }}
                                        >
                                            {user.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.78rem', fontWeight: 600 }}>
                                            {user.name}
                                        </Typography>
                                    </Stack>
                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.7rem' }}>
                                        @{safeHandle}
                                    </Typography>
                                </Box>
                            );
                        })
                    ) : (
                        <Typography sx={{ px: 1.1, py: 0.7, color: chatColors.textMuted, fontSize: '0.72rem' }}>
                            No members match "{mentionQuery}"
                        </Typography>
                    )}
                </Box>
            )}
            <Menu
                anchorEl={emojiAnchorEl}
                open={Boolean(emojiAnchorEl)}
                onClose={closeEmojiMenu}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: chatColors.panelBg,
                            border: `1px solid ${chatColors.borderStrong}`,
                        },
                    },
                }}
            >
                {QUICK_EMOJIS.map((emoji) => (
                    <MenuItem
                        key={emoji}
                        onClick={() => addEmoji(emoji)}
                        sx={{
                            minHeight: 28,
                            justifyContent: 'center',
                            fontSize: '1rem',
                            color: chatColors.textPrimary,
                        }}
                    >
                        {emoji}
                    </MenuItem>
                ))}
            </Menu>
            {contextHint && (
                <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontSize: '0.68rem', display: 'block', mt: 0.5 }}>
                    {contextHint}
                </Typography>
            )}
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75, px: 0.25 }}>
                <Typography variant="caption" sx={{ color: chatColors.textMuted, fontSize: '0.67rem' }}>
                    Press Enter to send, Shift+Enter for newline
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: value.length > MAX_MESSAGE_LENGTH ? chatColors.danger : chatColors.textMuted,
                        fontSize: '0.67rem',
                    }}
                >
                    {value.length}/{MAX_MESSAGE_LENGTH}
                </Typography>
            </Stack>
        </Box>
    );
}
