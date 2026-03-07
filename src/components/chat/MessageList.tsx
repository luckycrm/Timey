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
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';

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

interface CallEventMessage {
    kind: 'started' | 'ended';
    title: string;
}

interface CallWindow {
    title: string;
    startAt: bigint;
    endAt?: bigint;
    endMessageId?: bigint;
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

function parseCallEventMessage(content: string): CallEventMessage | null {
    const trimmed = content.trim();
    const started = trimmed.match(/^started a video call:\s*(.+)$/i);
    if (started) {
        return {
            kind: 'started',
            title: started[1]?.trim() || 'Team call',
        };
    }

    const ended = trimmed.match(/^ended the video call:\s*(.+)$/i);
    if (ended) {
        return {
            kind: 'ended',
            title: ended[1]?.trim() || 'Team call',
        };
    }

    return null;
}

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

function formatCallDuration(startAt: bigint, endAt: bigint): string {
    const diffMs = Math.max(0, Number(endAt) - Number(startAt));
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
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

    const callWindowByStartMessageId = new Map<string, CallWindow>();
    const hiddenCallEventMessageIds = new Set<string>();
    const pendingCallStartsByTitle = new Map<string, Message[]>();

    for (const msg of sortedMessages) {
        const event = parseCallEventMessage(msg.content);
        if (!event) continue;

        if (event.kind === 'started') {
            const queue = pendingCallStartsByTitle.get(event.title) || [];
            queue.push(msg);
            pendingCallStartsByTitle.set(event.title, queue);
            callWindowByStartMessageId.set(String(msg.id), {
                title: event.title,
                startAt: msg.created_at,
            });
            continue;
        }

        const queue = pendingCallStartsByTitle.get(event.title);
        if (queue && queue.length > 0) {
            const startMessage = queue.shift()!;
            callWindowByStartMessageId.set(String(startMessage.id), {
                title: event.title,
                startAt: startMessage.created_at,
                endAt: msg.created_at,
                endMessageId: msg.id,
            });
            hiddenCallEventMessageIds.add(String(msg.id));
        }
    }

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
                                borderRadius: appRadii.badge,
                                px: 0.35,
                                fontWeight: 600,
                            }),
                            ...(hasSearchHit && {
                                bgcolor: chatColors.searchHit,
                                borderRadius: appRadii.badge,
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
                    {normalizedSearch ? 'No messages match your search.' : 'No messages yet. Start a conversation.'}
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
                        if (hiddenCallEventMessageIds.has(String(msg.id))) {
                            return null;
                        }

                        const sender = getSender(msg.sender_id);
                        const isOwn = currentUserId !== null && msg.sender_id === currentUserId;
                        const prevMsg = i > 0 ? group.messages[i - 1] : null;
                        const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                            Number(msg.created_at) - Number(prevMsg.created_at) > 300000;
                        const reactions = reactionsByMessage[String(msg.id)] || [];
                        const replyCount = replyCountByMessage[String(msg.id)] || 0;
                        const isEditing = editingMessageId === msg.id;
                        const callEvent = parseCallEventMessage(msg.content);
                        const isCallEventMessage = callEvent !== null;
                        const callWindow = callWindowByStartMessageId.get(String(msg.id)) || null;
                        const isCallStartMessage = callEvent?.kind === 'started';
                        const hasEnded = isCallStartMessage && Boolean(callWindow?.endAt);
                        const callDisplayKind: 'started' | 'ended' =
                            hasEnded ? 'ended' : (callEvent?.kind || 'started');

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
                                    borderRadius: appRadii.card,
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
                                                    borderRadius: appRadii.control,
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
                                    ) : isCallEventMessage && callEvent ? (
                                        <Box
                                            sx={{
                                                mt: 0.2,
                                                borderRadius: appRadii.card,
                                                px: 1,
                                                py: 0.9,
                                                pl: 1.25,
                                                width: 'fit-content',
                                                maxWidth: { xs: '100%', sm: 360 },
                                                border: `1px solid ${chatColors.borderStrong}`,
                                                bgcolor: 'rgba(8,8,8,0.78)',
                                                backdropFilter: 'blur(10px)',
                                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                '&::before': {
                                                    content: '""',
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 2.5,
                                                    bgcolor: callDisplayKind === 'started' ? chatColors.success : chatColors.textMuted,
                                                },
                                            }}
                                        >
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Box
                                                    sx={{
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: 1,
                                                        bgcolor:
                                                            callDisplayKind === 'started'
                                                                ? 'rgba(56,200,114,0.16)'
                                                                : 'rgba(255,255,255,0.1)',
                                                        border:
                                                            callDisplayKind === 'started'
                                                                ? '1px solid rgba(56,200,114,0.28)'
                                                                : `1px solid ${chatColors.borderHover}`,
                                                        color:
                                                            callDisplayKind === 'started'
                                                                ? '#8bf5b4'
                                                                : '#c2c8d8',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {callDisplayKind === 'started' ? (
                                                        <VideocamRoundedIcon sx={{ fontSize: 15 }} />
                                                    ) : (
                                                        <CallEndRoundedIcon sx={{ fontSize: 15 }} />
                                                    )}
                                                </Box>

                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: chatColors.textPrimary,
                                                            fontWeight: 700,
                                                            fontSize: '0.76rem',
                                                            lineHeight: 1.35,
                                                        }}
                                                    >
                                                        Video meeting
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: '#d0d0d0',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 500,
                                                            lineHeight: 1.35,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {callWindow?.title || callEvent.title}
                                                    </Typography>
                                                </Box>

                                                <Chip
                                                    size="small"
                                                    label={callDisplayKind === 'started' ? 'Live' : 'Done'}
                                                    sx={{
                                                        height: 17,
                                                        flexShrink: 0,
                                                        bgcolor:
                                                            callDisplayKind === 'started'
                                                                ? 'rgba(56,200,114,0.16)'
                                                                : 'rgba(255,255,255,0.08)',
                                                        color:
                                                            callDisplayKind === 'started'
                                                                ? '#a0ffbf'
                                                                : '#bcc3d3',
                                                        fontWeight: 700,
                                                        border: `1px solid ${chatColors.border}`,
                                                        '& .MuiChip-label': {
                                                            px: 0.6,
                                                            fontSize: '0.58rem',
                                                        },
                                                    }}
                                                />
                                            </Stack>

                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    display: 'block',
                                                    mt: 0.5,
                                                    color: chatColors.textSecondary,
                                                    fontSize: '0.63rem',
                                                    letterSpacing: '0.01em',
                                                }}
                                            >
                                                {hasEnded && callWindow?.endAt
                                                    ? `Duration ${formatCallDuration(callWindow.startAt, callWindow.endAt)} • ${formatTime(callWindow.startAt)} to ${formatTime(callWindow.endAt)}`
                                                    : callEvent.kind === 'started'
                                                        ? 'Meeting is live • Use the call control in the header to join.'
                                                        : 'Meeting ended for all participants.'}
                                            </Typography>
                                        </Box>
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
                                                    color: '#d8e6ff',
                                                    fontSize: '0.69rem',
                                                    fontWeight: 700,
                                                    px: 1.05,
                                                    py: 0.28,
                                                    borderRadius: 1.25,
                                                    lineHeight: 1,
                                                    letterSpacing: '0.01em',
                                                    bgcolor: 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${chatColors.borderStrong}`,
                                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                                                    '& .MuiButton-startIcon': {
                                                        mr: 0.45,
                                                        ml: -0.1,
                                                    },
                                                    '&:hover': {
                                                        bgcolor: 'rgba(158,192,255,0.14)',
                                                        borderColor: 'rgba(158,192,255,0.45)',
                                                        color: '#f3f8ff',
                                                    },
                                                }}
                                            >
                                                {replyCount > 0 && onOpenThread
                                                    ? `View thread (${replyCount})`
                                                    : 'Reply'}
                                            </Button>
                                        )}
                                        {isOwn && onEditMessage && !isEditing && !isCallEventMessage && (
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
                        borderRadius: appRadii.full,
                        px: 1.5,
                        minHeight: 30,
                        '&:hover': { bgcolor: chatColors.actionBgHover },
                    }}
                >
                    Latest messages
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
