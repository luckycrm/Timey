import { MouseEvent, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddReactionRoundedIcon from '@mui/icons-material/AddReactionRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { chatColors } from '../../theme/chatColors';

interface Message {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    parent_message_id?: bigint;
    content: string;
    created_at: bigint;
    edited_at?: bigint;
}

interface ReactionSummary {
    emoji: string;
    count: number;
    reactedByMe: boolean;
}

interface MessageListProps {
    messages: Message[];
    users: any[];
    currentUserId: bigint | null;
    currentUserName?: string;
    searchTerm?: string;
    threadMode?: boolean;
    reactionsByMessage?: Record<string, ReactionSummary[]>;
    replyCountByMessage?: Record<string, number>;
    onToggleReaction?: (messageId: bigint, emoji: string) => void;
    onOpenThread?: (messageId: bigint) => void;
    onReply?: (message: Message) => void;
    onEditMessage?: (messageId: bigint, content: string) => Promise<void> | void;
}

const QUICK_REACTIONS = ['👍', '🔥', '😂', '🎉', '✅', '👀'];

function formatTime(timestamp: bigint): string {
    const date = new Date(Number(timestamp));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(timestamp: bigint): string {
    const date = new Date(Number(timestamp));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function MessageList({
    messages,
    users,
    currentUserId,
    currentUserName = '',
    searchTerm = '',
    threadMode = false,
    reactionsByMessage = {},
    replyCountByMessage = {},
    onToggleReaction,
    onOpenThread,
    onReply,
    onEditMessage,
}: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [editingMessageId, setEditingMessageId] = useState<bigint | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLElement | null>(null);
    const [reactionTargetMessageId, setReactionTargetMessageId] = useState<bigint | null>(null);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (isNearBottom) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
        }
    }, [isNearBottom, messages.length]);

    const sortedMessages = [...messages].sort((a, b) => Number(a.created_at) - Number(b.created_at));

    const getSender = (senderId: bigint) => {
        return users.find((u) => u.id === senderId);
    };

    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    for (const msg of sortedMessages) {
        const dateStr = formatDateHeader(msg.created_at);
        if (dateStr !== currentDate) {
            currentDate = dateStr;
            groups.push({ date: dateStr, messages: [] });
        }
        groups[groups.length - 1].messages.push(msg);
    }

    const renderContent = (content: string) => {
        const pieces = content.split(/(https?:\/\/[^\s]+)/g);
        return pieces.map((piece, pieceIndex) => {
            const isUrl = /^https?:\/\/[^\s]+$/i.test(piece);
            if (isUrl) {
                return (
                    <Box
                        key={`url-${pieceIndex}`}
                        component="a"
                        href={piece}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ color: chatColors.textPrimary, textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                        {piece}
                    </Box>
                );
            }

            const words = piece.split(/(\s+)/);
            return words.map((word, wordIndex) => {
                const mentionTarget = `@${currentUserName.replace(/\s+/g, '').toLowerCase()}`;
                const normalizedWord = word.toLowerCase();
                const isMention = normalizedWord.startsWith('@');
                const isOwnMention = mentionTarget.length > 1 && normalizedWord.includes(mentionTarget);
                const hasSearchHit = normalizedSearch.length > 0 && normalizedWord.includes(normalizedSearch);

                return (
                    <Box
                        key={`token-${pieceIndex}-${wordIndex}`}
                        component="span"
                        sx={{
                            ...(isMention && {
                                color: chatColors.textPrimary,
                                bgcolor: isOwnMention ? chatColors.searchHit : chatColors.mention,
                                borderRadius: 0.8,
                                px: 0.35,
                                fontWeight: 600,
                            }),
                            ...(hasSearchHit && {
                                bgcolor: chatColors.searchHit,
                                borderRadius: 0.7,
                            }),
                        }}
                    >
                        {word}
                    </Box>
                );
            });
        });
    };

    const onScroll = () => {
        const node = containerRef.current;
        if (!node) return;
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        setIsNearBottom(distance < 60);
    };

    const startEditing = (message: Message) => {
        setEditingMessageId(message.id);
        setEditingValue(message.content);
    };

    const saveEdit = async (messageId: bigint) => {
        if (!onEditMessage) return;
        if (!editingValue.trim()) return;
        setIsSavingEdit(true);
        try {
            await onEditMessage(messageId, editingValue.trim());
            setEditingMessageId(null);
            setEditingValue('');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const openReactionMenu = (event: MouseEvent<HTMLElement>, messageId: bigint) => {
        setReactionAnchorEl(event.currentTarget);
        setReactionTargetMessageId(messageId);
    };

    const closeReactionMenu = () => {
        setReactionAnchorEl(null);
        setReactionTargetMessageId(null);
    };

    const selectReaction = (emoji: string) => {
        if (reactionTargetMessageId != null) {
            onToggleReaction?.(reactionTargetMessageId, emoji);
        }
        closeReactionMenu();
    };

    if (sortedMessages.length === 0) {
        return (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography
                    variant="body2"
                    sx={{
                        color: chatColors.textFaint,
                        maxWidth: '92%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {normalizedSearch ? 'No messages match your search.' : 'No messages yet. Start the conversation!'}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                maxHeight: '100%',
                px: threadMode ? { xs: 0.9, sm: 1.2 } : { xs: 1.4, sm: 2.2, md: 2.8 },
                py: threadMode ? 1.25 : 2.2,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.35,
                position: 'relative',
            }}
            ref={containerRef}
            onScroll={onScroll}
        >
            {groups.map((group) => (
                <Box key={group.date}>
                    {threadMode ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.1 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: chatColors.textFaint,
                                    fontWeight: 600,
                                    fontSize: '0.66rem',
                                }}
                            >
                                {group.date}
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2.2 }}>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: chatColors.border }} />
                            <Typography
                                variant="caption"
                                sx={{
                                    color: chatColors.textFaint,
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {group.date}
                            </Typography>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: chatColors.border }} />
                        </Box>
                    )}

                    {group.messages.map((msg, i) => {
                        const sender = getSender(msg.sender_id);
                        const isOwn = currentUserId !== null && msg.sender_id === currentUserId;
                        const prevMsg = i > 0 ? group.messages[i - 1] : null;
                        const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                            Number(msg.created_at) - Number(prevMsg.created_at) > 300000;
                        const reactions = reactionsByMessage[String(msg.id)] || [];
                        const replyCount = replyCountByMessage[String(msg.id)] || 0;
                        const isEditing = editingMessageId === msg.id;

                        const colors = ['#1a1a1a', '#222222', '#2a2a2a', '#333333', '#444444', '#555555'];
                        const colorIndex = sender
                            ? sender.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length
                            : 0;

                        return (
                            <Box
                                key={String(msg.id)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1.15,
                                    py: showAvatar ? 0.68 : 0.28,
                                    px: threadMode ? 0.7 : 1,
                                    borderRadius: 1.25,
                                    '&:hover': { bgcolor: chatColors.hoverSoft },
                                }}
                            >
                                <Box sx={{ width: 36, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                    {showAvatar && sender && (
                                        <Avatar
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                bgcolor: colors[colorIndex],
                                                fontSize: '0.78rem',
                                                fontWeight: 800,
                                            }}
                                        >
                                            {sender.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                    )}
                                </Box>

                                <Box sx={{ flex: 1, minWidth: 0, pr: 0.8 }}>
                                    {showAvatar && (
                                        <Stack
                                            direction="row"
                                            spacing={0.75}
                                            alignItems="baseline"
                                            sx={{ mb: 0.3 }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: '#e0e0e0',
                                                    fontSize: '0.84rem',
                                                }}
                                            >
                                                {sender?.name || currentUserName || 'Unknown'}
                                            </Typography>
                                            {isOwn && (
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: '#74a7ff',
                                                        fontWeight: 700,
                                                        fontSize: '0.67rem',
                                                    }}
                                                >
                                                    You
                                                </Typography>
                                            )}
                                            <Typography variant="caption" sx={{ color: chatColors.textFaint, fontSize: '0.65rem' }}>
                                                {formatTime(msg.created_at)}
                                            </Typography>
                                            {(msg.edited_at || 0n) > 0n && (
                                                <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontSize: '0.62rem' }}>
                                                    (edited)
                                                </Typography>
                                            )}
                                        </Stack>
                                    )}

                                    {isEditing ? (
                                        <Stack
                                            direction="row"
                                            spacing={0.75}
                                            alignItems="center"
                                            sx={{ mt: 0.2 }}
                                        >
                                            <Box
                                                sx={{
                                                    flexGrow: 1,
                                                    border: `1px solid ${chatColors.borderStrong}`,
                                                    borderRadius: 1.5,
                                                    px: 1,
                                                    py: 0.5,
                                                    bgcolor: chatColors.inputBg,
                                                    minWidth: 180,
                                                }}
                                            >
                                                <InputBase
                                                    value={editingValue}
                                                    onChange={(event) => setEditingValue(event.target.value)}
                                                    multiline
                                                    maxRows={4}
                                                    fullWidth
                                                    sx={{ color: chatColors.textPrimary, fontSize: '0.84rem' }}
                                                />
                                            </Box>
                                            <IconButton
                                                size="small"
                                                onClick={() => void saveEdit(msg.id)}
                                                disabled={isSavingEdit || !editingValue.trim()}
                                                sx={{ color: chatColors.success }}
                                            >
                                                <CheckRoundedIcon sx={{ fontSize: 17 }} />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setEditingMessageId(null);
                                                    setEditingValue('');
                                                }}
                                                sx={{ color: chatColors.danger }}
                                            >
                                                <CloseRoundedIcon sx={{ fontSize: 17 }} />
                                            </IconButton>
                                        </Stack>
                                    ) : (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: '#d0d0d0',
                                                fontSize: '0.85rem',
                                                lineHeight: 1.55,
                                                wordBreak: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {renderContent(msg.content)}
                                        </Typography>
                                    )}

                                    <Stack
                                        className="message-actions"
                                        direction="row"
                                        spacing={0.65}
                                        alignItems="center"
                                        sx={{
                                            mt: 0.35,
                                            flexWrap: 'wrap',
                                            rowGap: 0.35,
                                            opacity: 1,
                                        }}
                                    >
                                        {onToggleReaction && (
                                            <Tooltip title="Add reaction">
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => openReactionMenu(event, msg.id)}
                                                    sx={{
                                                        width: 22,
                                                        height: 22,
                                                        color: chatColors.textSecondary,
                                                        '&:hover': {
                                                            color: chatColors.textPrimary,
                                                            bgcolor: chatColors.hover,
                                                        },
                                                    }}
                                                >
                                                    <AddReactionRoundedIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {(onReply || onOpenThread) && (
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    if (onReply) {
                                                        onReply(msg);
                                                    } else if (onOpenThread) {
                                                        onOpenThread(msg.id);
                                                    }
                                                }}
                                                startIcon={<SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 13 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    minWidth: 0,
                                                    color: '#9ec0ff',
                                                    fontSize: '0.71rem',
                                                    fontWeight: 700,
                                                    px: 0.95,
                                                    py: 0.2,
                                                    borderRadius: 1,
                                                    bgcolor: 'rgba(116,167,255,0.14)',
                                                    border: '1px solid rgba(116,167,255,0.35)',
                                                    '&:hover': {
                                                        bgcolor: 'rgba(116,167,255,0.24)',
                                                        borderColor: 'rgba(116,167,255,0.5)',
                                                    },
                                                }}
                                            >
                                                {replyCount > 0 && onOpenThread
                                                    ? `View thread (${replyCount})`
                                                    : 'Reply'}
                                            </Button>
                                        )}
                                        {isOwn && onEditMessage && !isEditing && (
                                            <Button
                                                size="small"
                                                onClick={() => startEditing(msg)}
                                                startIcon={<EditRoundedIcon sx={{ fontSize: 12 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    minWidth: 0,
                                                    color: chatColors.textSecondary,
                                                    fontSize: '0.71rem',
                                                    px: 0.7,
                                                    py: 0,
                                                }}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Stack>

                                    {reactions.length > 0 && (
                                        <Stack
                                            direction="row"
                                            spacing={0.55}
                                            alignItems="center"
                                            sx={{
                                                mt: 0.4,
                                                flexWrap: 'wrap',
                                                rowGap: 0.35,
                                            }}
                                        >
                                            {reactions.map((reaction) => (
                                                <Chip
                                                    key={`${String(msg.id)}-${reaction.emoji}`}
                                                    label={`${reaction.emoji} ${reaction.count}`}
                                                    size="small"
                                                    onClick={() => onToggleReaction?.(msg.id, reaction.emoji)}
                                                    sx={{
                                                        height: 22,
                                                        bgcolor: reaction.reactedByMe ? chatColors.selectionStrong : chatColors.hover,
                                                        color: reaction.reactedByMe ? chatColors.textPrimary : '#c2c8da',
                                                        border: reaction.reactedByMe ? `1px solid ${chatColors.borderHover}` : '1px solid transparent',
                                                        '& .MuiChip-label': { px: 0.8, fontSize: '0.72rem', fontWeight: 600 },
                                                    }}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            ))}
            <div ref={bottomRef} />
            {!isNearBottom && (
                <Button
                    size="small"
                    onClick={() => {
                        const container = containerRef.current;
                        if (!container) return;
                        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                    }}
                    startIcon={<KeyboardArrowDownRoundedIcon />}
                    sx={{
                        position: 'sticky',
                        bottom: 10,
                        alignSelf: 'center',
                        bgcolor: chatColors.actionBg,
                        color: chatColors.actionText,
                        textTransform: 'none',
                        borderRadius: 4,
                        px: 1.5,
                        minHeight: 30,
                        '&:hover': { bgcolor: chatColors.actionBgHover },
                    }}
                >
                    Jump to present
                </Button>
            )}
            <Menu
                anchorEl={reactionAnchorEl}
                open={Boolean(reactionAnchorEl)}
                onClose={closeReactionMenu}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: chatColors.panelBg,
                            border: `1px solid ${chatColors.borderStrong}`,
                        },
                    },
                }}
            >
                {QUICK_REACTIONS.map((emoji) => (
                    <MenuItem
                        key={emoji}
                        onClick={() => selectReaction(emoji)}
                        sx={{
                            minHeight: 28,
                            justifyContent: 'center',
                            color: chatColors.textPrimary,
                            fontSize: '1rem',
                        }}
                    >
                        {emoji}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
}
