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
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';

interface ChatChannel {
    id: bigint;
    name: string;
    type: string;
    created_at: bigint;
}

interface ChatUser {
    id: bigint;
    name: string;
    status?: string;
    lastSeenAt?: bigint;
    lastLoginAt?: bigint;
}

interface ChatMessage {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    content: string;
    created_at: bigint;
}

interface ChatScheduledMeeting {
    id: bigint;
    channel_id: bigint;
    title: string;
    scheduled_at: bigint;
    status: string;
    visibility?: string;
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
    activeCallByChannel?: Record<string, { title: string; participantCount: number }>;
    scheduledMeetings?: ChatScheduledMeeting[];
    joiningMeetingId?: bigint | null;
    onJoinMeeting?: (meetingId: bigint) => void;
    onOpenMeetingManager?: () => void;
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

function isLikelyOnline(user?: ChatUser | null): boolean {
    if (!user) return false;
    if (user.status === 'offline') return false;
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    if (lastSeen === undefined) return false;
    return Date.now() - Number(lastSeen) < 60_000;
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
    activeCallByChannel = {},
    scheduledMeetings = [],
    joiningMeetingId = null,
    onJoinMeeting,
    onOpenMeetingManager,
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
    const upcomingMeetings = useMemo(() => {
        const rows = scheduledMeetings
            .filter((meeting) => meeting.status === 'scheduled' || meeting.status === 'started')
            .sort((a, b) => Number(a.scheduled_at) - Number(b.scheduled_at));
        return rows.slice(0, 5);
    }, [scheduledMeetings]);

    const channelNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const channel of channels) {
            map.set(String(channel.id), channel.name);
        }
        return map;
    }, [channels]);

    const formatMeetingTime = (timestamp: bigint) =>
        new Date(Number(timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const getJoinAvailability = (meeting: ChatScheduledMeeting): { disabled: boolean; label: string } => {
        if (meeting.status === 'started') return { disabled: false, label: 'Join' };
        const joinOpenAt = Number(meeting.scheduled_at) - 10 * 60_000;
        const now = Date.now();
        if (now < joinOpenAt) {
            const mins = Math.max(1, Math.ceil((joinOpenAt - now) / 60_000));
            return { disabled: true, label: `${mins}m` };
        }
        return { disabled: false, label: 'Join' };
    };

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
                        bgcolor: chatColors.actionBg,
                        color: chatColors.actionText,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.76rem',
                        borderRadius: appRadii.control,
                        height: 34,
                        whiteSpace: 'nowrap',
                        '&:hover': { bgcolor: chatColors.actionBgHover },
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
                        borderColor: '#222',
                        color: chatColors.textPrimary,
                        bgcolor: chatColors.hoverSoft,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.76rem',
                        borderRadius: appRadii.control,
                        height: 34,
                        whiteSpace: 'nowrap',
                        '&:hover': { borderColor: chatColors.borderStrong, color: chatColors.textPrimary, bgcolor: chatColors.hover },
                    }}
                >
                    New Group
                </Button>
            </Stack>

            {/* Search */}
            <Box
                sx={{
                    bgcolor: chatColors.inputBg,
                    borderRadius: appRadii.control,
                    px: 1.5,
                    py: 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    border: `1px solid ${chatColors.border}`,
                    mb: 2,
                    '&:focus-within': { borderColor: chatColors.borderHover },
                }}
            >
                <SearchIcon sx={{ fontSize: 16, color: chatColors.textFaint }} />
                <InputBase
                    placeholder="Search chats..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                    sx={{ color: chatColors.textPrimary, fontSize: '0.8rem' }}
                />
            </Box>

            <Divider sx={{ borderColor: chatColors.border, mb: 1 }} />

            {upcomingMeetings.length > 0 && (
                <Box
                    sx={{
                        mb: 1.2,
                        p: 1,
                        borderRadius: appRadii.panel,
                        border: `1px solid ${chatColors.border}`,
                        bgcolor: chatColors.hoverSoft,
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: chatColors.textMuted,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                fontSize: '0.62rem',
                            }}
                        >
                            Upcoming Meetings
                        </Typography>
                        {onOpenMeetingManager && (
                            <Button
                                size="small"
                                onClick={onOpenMeetingManager}
                                sx={{
                                    minWidth: 0,
                                    px: 0.75,
                                    py: 0.2,
                                    textTransform: 'none',
                                    color: chatColors.textMuted,
                                    fontSize: '0.66rem',
                                    fontWeight: 600,
                                    '&:hover': { color: chatColors.textPrimary, bgcolor: 'rgba(255,255,255,0.04)' },
                                }}
                            >
                                Manage
                            </Button>
                        )}
                    </Stack>
                    <Stack spacing={0.65}>
                        {upcomingMeetings.map((meeting) => {
                            const availability = getJoinAvailability(meeting);
                            const loading = joiningMeetingId === meeting.id;
                            return (
                                <Box
                                    key={String(meeting.id)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        borderRadius: 1.2,
                                        px: 0.95,
                                        py: 0.65,
                                        bgcolor: 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography
                                            sx={{
                                                color: chatColors.textPrimary,
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {meeting.title}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                color: chatColors.textMuted,
                                                fontSize: '0.64rem',
                                                lineHeight: 1.2,
                                            }}
                                        >
                                            {meeting.visibility === 'public'
                                                ? `Public meeting • ${formatMeetingTime(meeting.scheduled_at)}`
                                                : `#${channelNameById.get(String(meeting.channel_id)) || 'channel'} • ${formatMeetingTime(meeting.scheduled_at)}`}
                                        </Typography>
                                    </Box>
                                    <Button
                                        size="small"
                                        startIcon={<VideocamRoundedIcon sx={{ fontSize: 12 }} />}
                                        onClick={() => onJoinMeeting?.(meeting.id)}
                                        disabled={loading || availability.disabled || !onJoinMeeting}
                                        sx={{
                                            minWidth: 0,
                                            px: 0.85,
                                            py: 0.3,
                                            borderRadius: 1,
                                            textTransform: 'none',
                                            fontSize: '0.66rem',
                                            fontWeight: 700,
                                            color: chatColors.textPrimary,
                                            border: '1px solid rgba(56,200,114,0.32)',
                                            bgcolor: availability.disabled
                                                ? 'rgba(255,255,255,0.03)'
                                                : 'rgba(56,200,114,0.13)',
                                            '&:hover': {
                                                bgcolor: availability.disabled
                                                    ? 'rgba(255,255,255,0.05)'
                                                    : 'rgba(56,200,114,0.22)',
                                            },
                                            '& .MuiButton-startIcon': { mr: 0.4 },
                                        }}
                                    >
                                        {loading ? 'Joining' : availability.label}
                                    </Button>
                                </Box>
                            );
                        })}
                    </Stack>
                </Box>
            )}

            {/* Channel List */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mx: -0.5 }}>
                {filteredChannels.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="caption" sx={{ color: chatColors.textFaint }}>
                            {search ? 'No results found' : 'No conversations yet'}
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1}>
                        <Box>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: chatColors.textMuted,
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
                                    const activeCall = activeCallByChannel[String(channel.id)] || null;
                                    const peer = getUserById(peerByChannel[String(channel.id)]);
                                    const peerOnline = isLikelyOnline(peer);

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
                                                borderRadius: appRadii.card,
                                                cursor: 'pointer',
                                                bgcolor: isSelected ? chatColors.selection : 'transparent',
                                                '&:hover': {
                                                    bgcolor: isSelected ? chatColors.selectionStrong : chatColors.hover,
                                                },
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <Box sx={{ position: 'relative' }}>
                                                <Avatar
                                                    sx={{
                                                        width: 30,
                                                        height: 30,
                                                        bgcolor: chatColors.border,
                                                        color: chatColors.textPrimary,
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
                                                            bgcolor: chatColors.success,
                                                            border: `2px solid ${chatColors.pageBg}`,
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
                                                            color: isSelected ? chatColors.textPrimary : '#d0d0d0',
                                                            fontSize: '0.82rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {(peer?.name || channel.name)}
                                                    </Typography>
                                                    {activeCall && (
                                                        <Chip
                                                            label={`Live ${activeCall.participantCount}`}
                                                            size="small"
                                                            sx={{
                                                                height: 16,
                                                                fontSize: '0.58rem',
                                                                bgcolor: 'rgba(80, 210, 130, 0.15)',
                                                                color: '#85f0ad',
                                                                fontWeight: 700,
                                                                '& .MuiChip-label': { px: 0.55 },
                                                            }}
                                                        />
                                                    )}
                                                    {lastMsg && (
                                                        <Typography variant="caption" sx={{ color: chatColors.textMuted, fontSize: '0.65rem' }}>
                                                            {formatRelativeTime(lastMsg.created_at)}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                                {lastMsg && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: unreadCount > 0 ? chatColors.textPrimary : chatColors.textMuted,
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
                                                        bgcolor: chatColors.danger,
                                                        color: chatColors.textPrimary,
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
                                    color: chatColors.textMuted,
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
                                    const activeCall = activeCallByChannel[String(channel.id)] || null;

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
                                                borderRadius: appRadii.card,
                                                cursor: 'pointer',
                                                bgcolor: isSelected ? chatColors.selection : 'transparent',
                                                '&:hover': {
                                                    bgcolor: isSelected ? chatColors.selectionStrong : chatColors.hover,
                                                },
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <TagRoundedIcon sx={{ fontSize: 17, color: isSelected ? chatColors.textPrimary : '#888' }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: unreadCount > 0 || isSelected ? 700 : 500,
                                                            color: isSelected ? chatColors.textPrimary : unreadCount > 0 ? chatColors.textPrimary : '#b8b8b8',
                                                            fontSize: '0.82rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {channel.name}
                                                    </Typography>
                                                    {activeCall && (
                                                        <Chip
                                                            label={`Live ${activeCall.participantCount}`}
                                                            size="small"
                                                            sx={{
                                                                height: 16,
                                                                fontSize: '0.58rem',
                                                                bgcolor: 'rgba(80, 210, 130, 0.15)',
                                                                color: '#85f0ad',
                                                                fontWeight: 700,
                                                                '& .MuiChip-label': { px: 0.55 },
                                                            }}
                                                        />
                                                    )}
                                                    <Stack direction="row" spacing={0.6} alignItems="center">
                                                        {lastMsg && (
                                                            <Typography variant="caption" sx={{ color: chatColors.textMuted, fontSize: '0.65rem' }}>
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
                                                                    bgcolor: chatColors.actionBg,
                                                                    color: chatColors.actionText,
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
                                                            color: chatColors.textMuted,
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
