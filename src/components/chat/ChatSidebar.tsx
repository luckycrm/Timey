import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import SearchIcon from '@mui/icons-material/Search';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';

interface ChatChannel {
    id: bigint;
    name: string;
    type: string;
    created_at: bigint;
}

interface ChatUser {
    id: bigint;
    name: string;
    lastLoginAt?: bigint;
}

interface ChatMessage {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    content: string;
    created_at: bigint;
}

interface ChatSidebarProps {
    channels: ChatChannel[];
    selectedChannelId: bigint | null;
    onSelectChannel: (id: bigint) => void;
    onNewChat: () => void;
    onNewGroup: () => void;
    users: ChatUser[];
    messages: ChatMessage[];
    unreadCountsByChannel?: Record<string, number>;
    peerByChannel?: Record<string, bigint | null>;
}

function formatRelativeTime(timestamp: bigint): string {
    const deltaMs = Date.now() - Number(timestamp);
    const oneMinute = 60_000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;
    if (deltaMs < oneMinute) return 'now';
    if (deltaMs < oneHour) return `${Math.floor(deltaMs / oneMinute)}m`;
    if (deltaMs < oneDay) return `${Math.floor(deltaMs / oneHour)}h`;
    return `${Math.floor(deltaMs / oneDay)}d`;
}

function isLikelyOnline(lastLoginAt?: bigint): boolean {
    if (lastLoginAt === undefined) return false;
    return Date.now() - Number(lastLoginAt) < 5 * 60_000;
}

export function ChatSidebar({
    channels,
    selectedChannelId,
    onSelectChannel,
    onNewChat,
    onNewGroup,
    users,
    messages,
    unreadCountsByChannel = {},
    peerByChannel = {},
}: ChatSidebarProps) {
    const [search, setSearch] = useState('');

    const getLastMessage = useMemo(() => {
        const byChannel = new Map<string, ChatMessage>();
        for (const msg of messages) {
            const key = String(msg.channel_id);
            const existing = byChannel.get(key);
            if (!existing || Number(msg.created_at) > Number(existing.created_at)) {
                byChannel.set(key, msg);
            }
        }
        return byChannel;
    }, [messages]);

    const getUserById = (userId: bigint | null | undefined) =>
        userId == null ? null : users.find((u) => u.id === userId) || null;

    const filteredChannels = useMemo(() => {
        const lowered = search.trim().toLowerCase();
        const visible = lowered
            ? channels.filter((ch) => ch.name.toLowerCase().includes(lowered))
            : channels;
        return [...visible].sort((a, b) => {
            const lastA = getLastMessage.get(String(a.id));
            const lastB = getLastMessage.get(String(b.id));
            if (lastA && lastB) return Number(lastB.created_at) - Number(lastA.created_at);
            if (lastA) return -1;
            if (lastB) return 1;
            return Number(b.created_at) - Number(a.created_at);
        });
    }, [channels, getLastMessage, search]);

    const dmChannels = filteredChannels.filter((ch) => ch.type === 'dm');
    const groupChannels = filteredChannels.filter((ch) => ch.type !== 'dm');

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Action Buttons */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={onNewChat}
                    fullWidth
                    sx={{
                        bgcolor: '#ffffff',
                        color: '#000000',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        borderRadius: 1.5,
                        height: 36,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                    }}
                >
                    New Chat
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<GroupAddRoundedIcon />}
                    onClick={onNewGroup}
                    fullWidth
                    sx={{
                        borderColor: '#333',
                        color: '#858585',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        borderRadius: 1.5,
                        height: 36,
                        '&:hover': { borderColor: '#555', color: '#fff' },
                    }}
                >
                    New Group
                </Button>
            </Stack>

            {/* Search */}
            <Box
                sx={{
                    bgcolor: '#111',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    border: '1px solid #1a1a1a',
                    mb: 2,
                    '&:focus-within': { borderColor: '#444' },
                }}
            >
                <SearchIcon sx={{ fontSize: 16, color: '#555' }} />
                <InputBase
                    placeholder="Search chats..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                    sx={{ color: '#fff', fontSize: '0.8rem' }}
                />
            </Box>

            <Divider sx={{ borderColor: '#1a1a1a', mb: 1 }} />

            {/* Channel List */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mx: -0.5 }}>
                {filteredChannels.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="caption" sx={{ color: '#555' }}>
                            {search ? 'No results found' : 'No conversations yet'}
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1}>
                        <Box>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#666',
                                    fontWeight: 700,
                                    px: 1.5,
                                    mb: 0.75,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    fontSize: '0.62rem',
                                }}
                            >
                                Direct Messages
                            </Typography>
                            <Stack spacing={0.25}>
                                {dmChannels.map((channel) => {
                                    const isSelected = selectedChannelId === channel.id;
                                    const lastMsg = getLastMessage.get(String(channel.id));
                                    const unreadCount = unreadCountsByChannel[String(channel.id)] || 0;
                                    const peer = getUserById(peerByChannel[String(channel.id)]);
                                    const peerOnline = isLikelyOnline(peer?.lastLoginAt);

                                    return (
                                        <Box
                                            key={String(channel.id)}
                                            onClick={() => onSelectChannel(channel.id)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.25,
                                                px: 1.5,
                                                py: 0.9,
                                                borderRadius: 1.5,
                                                cursor: 'pointer',
                                                bgcolor: isSelected ? 'rgba(88,101,242,0.22)' : 'transparent',
                                                '&:hover': {
                                                    bgcolor: isSelected ? 'rgba(88,101,242,0.3)' : 'rgba(255,255,255,0.04)',
                                                },
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <Box sx={{ position: 'relative' }}>
                                                <Avatar
                                                    sx={{
                                                        width: 30,
                                                        height: 30,
                                                        bgcolor: '#1f2a38',
                                                        color: '#d6e4ff',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {(peer?.name || channel.name).charAt(0).toUpperCase()}
                                                </Avatar>
                                                {peerOnline && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            right: -1,
                                                            bottom: -1,
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: '50%',
                                                            bgcolor: '#38c872',
                                                            border: '2px solid #000',
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: isSelected ? 700 : 500,
                                                            color: isSelected ? '#fff' : '#d0d0d0',
                                                            fontSize: '0.82rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {(peer?.name || channel.name)}
                                                    </Typography>
                                                    {lastMsg && (
                                                        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem' }}>
                                                            {formatRelativeTime(lastMsg.created_at)}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                                {lastMsg && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: unreadCount > 0 ? '#dce6ff' : '#666',
                                                            fontSize: '0.69rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'block',
                                                            fontWeight: unreadCount > 0 ? 600 : 400,
                                                        }}
                                                    >
                                                        {lastMsg.content}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {unreadCount > 0 && (
                                                <Chip
                                                    label={unreadCount > 99 ? '99+' : String(unreadCount)}
                                                    size="small"
                                                    sx={{
                                                        height: 18,
                                                        fontSize: '0.65rem',
                                                        bgcolor: '#e33d4f',
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                        '& .MuiChip-label': { px: 0.7 },
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>

                        <Box>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#666',
                                    fontWeight: 700,
                                    px: 1.5,
                                    mb: 0.75,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    fontSize: '0.62rem',
                                }}
                            >
                                Group Channels
                            </Typography>
                            <Stack spacing={0.25}>
                                {groupChannels.map((channel) => {
                                    const isSelected = selectedChannelId === channel.id;
                                    const lastMsg = getLastMessage.get(String(channel.id));
                                    const unreadCount = unreadCountsByChannel[String(channel.id)] || 0;

                                    return (
                                        <Box
                                            key={String(channel.id)}
                                            onClick={() => onSelectChannel(channel.id)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                px: 1.5,
                                                py: 0.75,
                                                borderRadius: 1.5,
                                                cursor: 'pointer',
                                                bgcolor: isSelected ? 'rgba(88,101,242,0.22)' : 'transparent',
                                                '&:hover': {
                                                    bgcolor: isSelected ? 'rgba(88,101,242,0.3)' : 'rgba(255,255,255,0.04)',
                                                },
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <TagRoundedIcon sx={{ fontSize: 17, color: isSelected ? '#fff' : '#888' }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: unreadCount > 0 || isSelected ? 700 : 500,
                                                            color: isSelected ? '#fff' : unreadCount > 0 ? '#dce6ff' : '#b8b8b8',
                                                            fontSize: '0.82rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {channel.name}
                                                    </Typography>
                                                    <Stack direction="row" spacing={0.6} alignItems="center">
                                                        {lastMsg && (
                                                            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem' }}>
                                                                {formatRelativeTime(lastMsg.created_at)}
                                                            </Typography>
                                                        )}
                                                        {unreadCount > 0 && (
                                                            <Chip
                                                                label={unreadCount > 99 ? '99+' : String(unreadCount)}
                                                                size="small"
                                                                sx={{
                                                                    height: 18,
                                                                    fontSize: '0.65rem',
                                                                    bgcolor: '#5865F2',
                                                                    color: '#fff',
                                                                    fontWeight: 700,
                                                                    '& .MuiChip-label': { px: 0.7 },
                                                                }}
                                                            />
                                                        )}
                                                    </Stack>
                                                </Stack>
                                                {lastMsg && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: '#666',
                                                            fontSize: '0.69rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'block',
                                                        }}
                                                    >
                                                        <AlternateEmailRoundedIcon sx={{ fontSize: 11, mr: 0.2, verticalAlign: 'text-bottom' }} />
                                                        {lastMsg.content}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    </Stack>
                )}
            </Box>
        </Box>
    );
}
