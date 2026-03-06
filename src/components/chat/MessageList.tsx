import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

interface Message {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    content: string;
    created_at: bigint;
}

interface MessageListProps {
    messages: Message[];
    users: any[];
    currentUserId: bigint | null;
    currentUserName?: string;
    searchTerm?: string;
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

export function MessageList({
    messages,
    users,
    currentUserId,
    currentUserName = '',
    searchTerm = '',
}: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNearBottom, setIsNearBottom] = useState(true);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    useEffect(() => {
        if (isNearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isNearBottom, messages.length]);

    const sortedMessages = [...messages].sort((a, b) => Number(a.created_at) - Number(b.created_at));

    const getSender = (senderId: bigint) => {
        return users.find(u => u.id === senderId);
    };

    // Group messages by date
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
                        sx={{ color: '#74a7ff', textDecoration: 'underline', wordBreak: 'break-all' }}
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
                const isOwnMention =
                    mentionTarget.length > 1 &&
                    normalizedWord.includes(mentionTarget);
                const hasSearchHit =
                    normalizedSearch.length > 0 &&
                    normalizedWord.includes(normalizedSearch);

                return (
                    <Box
                        key={`token-${pieceIndex}-${wordIndex}`}
                        component="span"
                        sx={{
                            ...(isMention && {
                                color: isOwnMention ? '#ffcf70' : '#9bb8ff',
                                bgcolor: isOwnMention ? 'rgba(255, 204, 102, 0.15)' : 'rgba(88, 101, 242, 0.16)',
                                borderRadius: 0.8,
                                px: 0.35,
                                fontWeight: 600,
                            }),
                            ...(hasSearchHit && {
                                bgcolor: 'rgba(251, 188, 4, 0.26)',
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

    const hasResults = sortedMessages.length > 0;
    if (!hasResults) {
        return (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: '#555' }}>
                    {normalizedSearch ? 'No messages match your search.' : 'No messages yet. Start the conversation!'}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flexGrow: 1,
                overflowY: 'auto',
                px: 3,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                position: 'relative',
            }}
            ref={containerRef}
            onScroll={onScroll}
        >
            {groups.map((group) => (
                <Box key={group.date}>
                    {/* Date Separator */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#1a1a1a' }} />
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#555',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {group.date}
                        </Typography>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#1a1a1a' }} />
                    </Box>

                    {/* Messages */}
                    {group.messages.map((msg, i) => {
                        const sender = getSender(msg.sender_id);
                        const isOwn = currentUserId !== null && msg.sender_id === currentUserId;
                        const prevMsg = i > 0 ? group.messages[i - 1] : null;
                        const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                            Number(msg.created_at) - Number(prevMsg.created_at) > 300000; // 5 min gap

                        const colors = ['#1565c0', '#00695c', '#ef6c00', '#c62828', '#6a1b9a', '#0277bd'];
                        const colorIndex = sender
                            ? sender.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length
                            : 0;

                        return (
                            <Box
                                key={String(msg.id)}
                                sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    py: showAvatar ? 0.8 : 0.15,
                                    px: 1,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                                }}
                            >
                                {/* Avatar column */}
                                <Box sx={{ width: 36, flexShrink: 0 }}>
                                    {showAvatar && sender && (
                                        <Avatar
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                bgcolor: colors[colorIndex],
                                                fontSize: '0.8rem',
                                                fontWeight: 800,
                                            }}
                                        >
                                            {sender.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                    )}
                                </Box>

                                {/* Message content */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {showAvatar && (
                                        <Stack direction="row" spacing={1} alignItems="baseline">
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: isOwn ? '#7cb3f5' : '#e0e0e0',
                                                    fontSize: '0.85rem',
                                                }}
                                            >
                                                {sender?.name || 'Unknown'}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{ color: '#555', fontSize: '0.65rem' }}
                                            >
                                                {formatTime(msg.created_at)}
                                            </Typography>
                                        </Stack>
                                    )}
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: '#d0d0d0',
                                            fontSize: '0.85rem',
                                            lineHeight: 1.5,
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {renderContent(msg.content)}
                                    </Typography>
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
                    onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    startIcon={<KeyboardArrowDownRoundedIcon />}
                    sx={{
                        position: 'sticky',
                        bottom: 10,
                        alignSelf: 'center',
                        bgcolor: '#5865F2',
                        color: '#fff',
                        textTransform: 'none',
                        borderRadius: 4,
                        px: 1.5,
                        minHeight: 30,
                        '&:hover': { bgcolor: '#4c59de' },
                    }}
                >
                    Jump to present
                </Button>
            )}
        </Box>
    );
}
