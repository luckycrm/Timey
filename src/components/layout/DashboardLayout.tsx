import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ModeEditOutlineOutlinedIcon from '@mui/icons-material/ModeEditOutlineOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import TurnedInNotOutlinedIcon from '@mui/icons-material/TurnedInNotOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MinimizeRoundedIcon from '@mui/icons-material/MinimizeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDB, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { AppLogo } from '../common/AppLogo';
import { chatColors } from '../../theme/chatColors';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { tables, reducers } from '../../module_bindings';
import type {
    ChatChannel as DbChatChannel,
    ChatChannelMember as DbChatChannelMember,
    ChatMessage as DbChatMessage,
    ChatReaction as DbChatReaction,
    ChatReadState as DbChatReadState,
    OrganizationMember as DbOrganizationMember,
    User as DbUser,
    UserPresence as DbUserPresence,
} from '../../module_bindings/types';
import messageSoundUrl from '../../../assets/message.mp3';

const NONE_U64 = 18446744073709551615n;

interface DockMessageRow {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    parent_message_id?: bigint;
    content: string;
    created_at: bigint;
    edited_at?: bigint;
}

const SideItem = ({ icon: Icon, label, active = false, onClick }: any) => (
    <Tooltip title={label} placement="right" arrow>
        <IconButton
            onClick={onClick}
            sx={{
                borderRadius: 2,
                color: active ? '#ffffff' : '#858585',
                bgcolor: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                },
                width: 44,
                height: 44,
            }}
        >
            <Icon sx={{ fontSize: 22 }} />
        </IconButton>
    </Tooltip>
);

const WorkspaceNavItem = ({ icon: Icon, label, to = '/' }: any) => {
    const location = useLocation();
    const active = location.pathname === to;

    return (
        <Link
            to={to}
            style={{ textDecoration: 'none' }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    color: active ? '#ffffff' : '#858585',
                    bgcolor: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.04)',
                        color: '#ffffff',
                    },
                    transition: 'all 0.2s',
                }}
            >
                <Icon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {label}
                </Typography>
            </Box>
        </Link>
    );
};

interface DashboardLayoutProps {
    children: React.ReactNode;
    onLogout?: () => void;
    orgName?: string;
    chatSidebar?: React.ReactNode;
}

export function DashboardLayout({ children, onLogout, orgName = 'boats', chatSidebar }: DashboardLayoutProps) {
    const { email } = useAuth();
    const { identity, isActive } = useSpacetimeDB();
    const location = useLocation();
    const navigate = useNavigate();
    const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
    const [allUsers] = useSpacetimeDBQuery(isActive ? tables.user : 'skip');
    const [allPresenceRows] = useSpacetimeDBQuery(isActive ? tables.user_presence : 'skip');
    const [allMessages] = useSpacetimeDBQuery(isActive ? tables.chat_message : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isActive ? tables.chat_channel_member : 'skip');
    const [allChannels] = useSpacetimeDBQuery(isActive ? tables.chat_channel : 'skip');
    const [allMembershipRows] = useSpacetimeDBQuery(isActive ? tables.organization_member : 'skip');
    const [allReadStates] = useSpacetimeDBQuery(isActive ? tables.chat_read_state : 'skip');
    const [allReactions] = useSpacetimeDBQuery(isActive ? tables.chat_reaction : 'skip');
    const sendMessageReducer = useReducer(reducers.sendMessage);
    const createChannelReducer = useReducer(reducers.createChannel);
    const heartbeatReducer = useReducer(reducers.heartbeat);
    const markChannelReadReducer = useReducer(reducers.markChannelRead);
    const toggleReactionReducer = useReducer(reducers.toggleReaction);
    const editMessageReducer = useReducer(reducers.editMessage);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hasHydratedMessagesRef = useRef(false);
    const lastNotifiedMessageAtRef = useRef<bigint>(0n);
    const lastMarkedDockReadRef = useRef<Record<string, string>>({});
    const [messengerSearch, setMessengerSearch] = useState('');
    const [openDmWindowIds, setOpenDmWindowIds] = useState<bigint[]>([]);
    const [pendingPeerOpenId, setPendingPeerOpenId] = useState<bigint | null>(null);
    const [isMessengerMinimized, setIsMessengerMinimized] = useState(false);
    const [minimizedWindowIds, setMinimizedWindowIds] = useState<bigint[]>([]);
    const [activeThreadParentByChannel, setActiveThreadParentByChannel] = useState<Record<string, bigint | null>>({});

    const users = (allUsers || []) as DbUser[];
    const presenceRows = (allPresenceRows || []) as DbUserPresence[];
    const messages = (allMessages || []) as DbChatMessage[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const channels = (allChannels || []) as DbChatChannel[];
    const membershipRows = (allMembershipRows || []) as DbOrganizationMember[];
    const readStates = (allReadStates || []) as DbChatReadState[];
    const reactions = (allReactions || []) as DbChatReaction[];
    const currentDbUser = identity == null ? null : users.find((user) => user.identity.isEqual(identity)) || null;
    const currentPresence =
        currentDbUser == null
            ? null
            : presenceRows.find((row) => row.userId === currentDbUser.id) || null;
    const isUserOnline =
        currentPresence != null &&
        currentPresence.status !== 'offline' &&
        Date.now() - Number(currentPresence.lastSeenAt) < 90_000;
    const userStatusLabel = isUserOnline ? 'Online' : 'Offline';
    const userStatusColor = isUserOnline ? '#38c872' : '#666666';

    const userById = useMemo(() => {
        const map = new Map<string, DbUser>();
        for (const user of users) {
            map.set(String(user.id), user);
        }
        return map;
    }, [users]);

    const presenceByUser = useMemo(() => {
        const map = new Map<string, DbUserPresence>();
        for (const row of presenceRows) {
            map.set(String(row.userId), row);
        }
        return map;
    }, [presenceRows]);

    const myChannelIds = useMemo(() => {
        if (currentDbUser == null) return new Set<string>();
        return new Set(
            channelMembers
                .filter((member) => member.userId === currentDbUser.id)
                .map((member) => String(member.channelId))
        );
    }, [channelMembers, currentDbUser]);

    const channelMembersByChannel = useMemo(() => {
        const map = new Map<string, DbChatChannelMember[]>();
        for (const row of channelMembers) {
            const key = String(row.channelId);
            const existing = map.get(key);
            if (existing) {
                existing.push(row);
            } else {
                map.set(key, [row]);
            }
        }
        return map;
    }, [channelMembers]);

    const lastMessageByChannel = useMemo(() => {
        const map = new Map<string, DbChatMessage>();
        for (const msg of messages) {
            if (msg.parentMessageId !== 0n && msg.parentMessageId !== NONE_U64) continue;
            const key = String(msg.channelId);
            const existing = map.get(key);
            if (!existing || Number(msg.createdAt) > Number(existing.createdAt)) {
                map.set(key, msg);
            }
        }
        return map;
    }, [messages]);

    const myDmChannels = useMemo(() => {
        if (currentDbUser == null) return [];
        return channels
            .filter((channel) => channel.type === 'dm' && myChannelIds.has(String(channel.id)))
            .sort((a, b) => {
                const aLast = lastMessageByChannel.get(String(a.id));
                const bLast = lastMessageByChannel.get(String(b.id));
                if (aLast && bLast) return Number(bLast.createdAt) - Number(aLast.createdAt);
                if (aLast) return -1;
                if (bLast) return 1;
                return Number(b.createdAt) - Number(a.createdAt);
            });
    }, [channels, currentDbUser, lastMessageByChannel, myChannelIds]);

    const myGroupChannels = useMemo(() => {
        if (currentDbUser == null) return [];
        return channels
            .filter((channel) => channel.type !== 'dm' && myChannelIds.has(String(channel.id)))
            .sort((a, b) => {
                const aLast = lastMessageByChannel.get(String(a.id));
                const bLast = lastMessageByChannel.get(String(b.id));
                if (aLast && bLast) return Number(bLast.createdAt) - Number(aLast.createdAt);
                if (aLast) return -1;
                if (bLast) return 1;
                return Number(b.createdAt) - Number(a.createdAt);
            });
    }, [channels, currentDbUser, lastMessageByChannel, myChannelIds]);

    const dockChannels = useMemo(
        () => [...myDmChannels, ...myGroupChannels],
        [myDmChannels, myGroupChannels]
    );

    const mentionUsersByChannel = useMemo(() => {
        const map = new Map<string, Array<{ id: bigint; name: string }>>();
        for (const channel of dockChannels) {
            const members = channelMembersByChannel.get(String(channel.id)) || [];
            const rows = members
                .map((member) => userById.get(String(member.userId)) || null)
                .filter((user): user is DbUser => user != null)
                .map((user) => ({ id: user.id, name: user.name }));
            map.set(String(channel.id), rows);
        }
        return map;
    }, [channelMembersByChannel, dockChannels, userById]);

    const peerByDmChannel = useMemo(() => {
        const map = new Map<string, DbUser | null>();
        if (currentDbUser == null) return map;

        for (const channel of myDmChannels) {
            const members = channelMembers.filter((row) => row.channelId === channel.id);
            const peer = members
                .map((row) => userById.get(String(row.userId)) || null)
                .find((user) => user != null && user.id !== currentDbUser.id) || null;
            map.set(String(channel.id), peer);
        }
        return map;
    }, [channelMembers, currentDbUser, myDmChannels, userById]);

    const dockMessagesByChannel = useMemo(() => {
        const map = new Map<string, DbChatMessage[]>();
        const dockChannelIdSet = new Set(dockChannels.map((channel) => String(channel.id)));

        for (const msg of messages) {
            const channelId = String(msg.channelId);
            if (!dockChannelIdSet.has(channelId)) continue;
            const existing = map.get(channelId);
            if (existing) {
                existing.push(msg);
            } else {
                map.set(channelId, [msg]);
            }
        }

        for (const list of map.values()) {
            list.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
        }

        return map;
    }, [dockChannels, messages]);

    const dockMessageRowsByChannel = useMemo(() => {
        const map = new Map<string, DockMessageRow[]>();
        for (const [channelId, rows] of dockMessagesByChannel.entries()) {
            map.set(
                channelId,
                rows.map((msg) => ({
                    id: msg.id,
                    channel_id: msg.channelId,
                    sender_id: msg.senderId,
                    parent_message_id: msg.parentMessageId === NONE_U64 ? 0n : msg.parentMessageId,
                    content: msg.content,
                    created_at: msg.createdAt,
                    edited_at: msg.editedAt === NONE_U64 ? 0n : msg.editedAt,
                }))
            );
        }
        return map;
    }, [dockMessagesByChannel]);

    const dockRootRowsByChannel = useMemo(() => {
        const map = new Map<string, DockMessageRow[]>();
        for (const [channelId, rows] of dockMessageRowsByChannel.entries()) {
            map.set(
                channelId,
                rows.filter((row) => (row.parent_message_id || 0n) === 0n)
            );
        }
        return map;
    }, [dockMessageRowsByChannel]);

    const dockRepliesByParentByChannel = useMemo(() => {
        const map = new Map<string, Map<string, DockMessageRow[]>>();
        for (const [channelId, rows] of dockMessageRowsByChannel.entries()) {
            const byParent = new Map<string, DockMessageRow[]>();
            for (const row of rows) {
                const parentId = row.parent_message_id || 0n;
                if (parentId === 0n) continue;
                const key = String(parentId);
                const existing = byParent.get(key);
                if (existing) {
                    existing.push(row);
                } else {
                    byParent.set(key, [row]);
                }
            }
            for (const replyRows of byParent.values()) {
                replyRows.sort((a, b) => Number(a.created_at) - Number(b.created_at));
            }
            map.set(channelId, byParent);
        }
        return map;
    }, [dockMessageRowsByChannel]);

    const replyCountByMessageByChannel = useMemo(() => {
        const map = new Map<string, Record<string, number>>();
        for (const [channelId, repliesByParent] of dockRepliesByParentByChannel.entries()) {
            const counts: Record<string, number> = {};
            for (const [parentId, rows] of repliesByParent.entries()) {
                counts[parentId] = rows.length;
            }
            map.set(channelId, counts);
        }
        return map;
    }, [dockRepliesByParentByChannel]);

    const reactionsByMessage = useMemo(() => {
        const result: Record<string, { emoji: string; count: number; reactedByMe: boolean }[]> = {};
        if (currentDbUser == null) return result;

        const reactionBucket = new Map<string, { messageId: string; emoji: string; count: number; reactedByMe: boolean }>();

        for (const row of reactions) {
            if (!row.isActive) continue;
            const key = `${String(row.messageId)}::${row.emoji}`;
            const existing = reactionBucket.get(key);
            if (existing) {
                existing.count += 1;
                if (row.userId === currentDbUser.id) existing.reactedByMe = true;
            } else {
                reactionBucket.set(key, {
                    messageId: String(row.messageId),
                    emoji: row.emoji,
                    count: 1,
                    reactedByMe: row.userId === currentDbUser.id,
                });
            }
        }

        for (const value of reactionBucket.values()) {
            if (!result[value.messageId]) result[value.messageId] = [];
            result[value.messageId].push({
                emoji: value.emoji,
                count: value.count,
                reactedByMe: value.reactedByMe,
            });
        }

        for (const messageId of Object.keys(result)) {
            result[messageId].sort((a, b) => b.count - a.count);
        }

        return result;
    }, [currentDbUser, reactions]);

    const dmChannelByPeerId = useMemo(() => {
        const map = new Map<string, DbChatChannel>();
        for (const channel of myDmChannels) {
            const peer = peerByDmChannel.get(String(channel.id));
            if (peer) {
                map.set(String(peer.id), channel);
            }
        }
        return map;
    }, [myDmChannels, peerByDmChannel]);

    const currentOrgId = useMemo(() => {
        if (currentDbUser == null) return null;
        return membershipRows.find((row) => row.userId === currentDbUser.id)?.orgId ?? null;
    }, [currentDbUser, membershipRows]);

    const orgMembers = useMemo(() => {
        if (currentDbUser == null || currentOrgId == null) return [];
        const memberIds = new Set(
            membershipRows
                .filter((row) => row.orgId === currentOrgId)
                .map((row) => String(row.userId))
        );
        return users
            .filter((user) => user.id !== currentDbUser.id && memberIds.has(String(user.id)))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [currentDbUser, currentOrgId, membershipRows, users]);

    const readStateByChannel = useMemo(() => {
        const map = new Map<string, DbChatReadState>();
        if (!currentDbUser) return map;
        for (const row of readStates) {
            if (row.userId !== currentDbUser.id) continue;
            const key = String(row.channelId);
            const existing = map.get(key);
            if (!existing || Number(row.lastReadAt) > Number(existing.lastReadAt)) {
                map.set(key, row);
            }
        }
        return map;
    }, [currentDbUser, readStates]);

    const messengerContacts = useMemo(() => {
        const q = messengerSearch.trim().toLowerCase();

        return orgMembers
            .map((member) => {
                const dmChannel = dmChannelByPeerId.get(String(member.id)) || null;
                const channelId = dmChannel?.id || null;
                const channelMessages = channelId ? dockMessagesByChannel.get(String(channelId)) || [] : [];
                const unreadCount = channelId
                    ? channelMessages.filter((msg) => {
                        const readAt = Number(readStateByChannel.get(String(channelId))?.lastReadAt || 0n);
                        return msg.senderId === member.id && Number(msg.createdAt) > readAt;
                    }).length
                    : 0;

                const lastMessage = channelId ? lastMessageByChannel.get(String(channelId)) || null : null;
                return {
                    member,
                    dmChannel,
                    unreadCount,
                    lastMessage,
                };
            })
            .filter((row) => {
                if (!q) return true;
                return row.member.name.toLowerCase().includes(q) ||
                    row.lastMessage?.content.toLowerCase().includes(q);
            });
    }, [
        dmChannelByPeerId,
        dockMessagesByChannel,
        lastMessageByChannel,
        messengerSearch,
        orgMembers,
        readStateByChannel,
    ]);

    const messengerGroups = useMemo(() => {
        const q = messengerSearch.trim().toLowerCase();
        return myGroupChannels
            .map((channel) => {
                const channelMessages = dockMessagesByChannel.get(String(channel.id)) || [];
                const readAt = Number(readStateByChannel.get(String(channel.id))?.lastReadAt || 0n);
                const unreadCount = channelMessages.filter((msg) => {
                    return currentDbUser != null &&
                        msg.senderId !== currentDbUser.id &&
                        Number(msg.createdAt) > readAt;
                }).length;
                const lastMessage = lastMessageByChannel.get(String(channel.id)) || null;
                return {
                    channel,
                    unreadCount,
                    lastMessage,
                };
            })
            .filter((row) => {
                if (!q) return true;
                return row.channel.name.toLowerCase().includes(q) ||
                    row.lastMessage?.content.toLowerCase().includes(q);
            });
    }, [currentDbUser, dockMessagesByChannel, lastMessageByChannel, messengerSearch, myGroupChannels, readStateByChannel]);

    const totalUnread = useMemo(
        () =>
            messengerContacts.reduce((acc, contact) => acc + contact.unreadCount, 0) +
            messengerGroups.reduce((acc, group) => acc + group.unreadCount, 0),
        [messengerContacts, messengerGroups]
    );

    const openDmWindow = (channelId: bigint) => {
        setOpenDmWindowIds((current) => {
            const next = [...current.filter((id) => id !== channelId), channelId];
            return next.slice(-2);
        });
        setMinimizedWindowIds((current) => current.filter((id) => id !== channelId));
    };

    const closeDmWindow = (channelId: bigint) => {
        setOpenDmWindowIds((current) => current.filter((id) => id !== channelId));
        setMinimizedWindowIds((current) => current.filter((id) => id !== channelId));
        setActiveThreadParentByChannel((current) => {
            const key = String(channelId);
            if (!(key in current)) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
    };

    const toggleWindowMinimized = (channelId: bigint) => {
        setMinimizedWindowIds((current) =>
            current.includes(channelId)
                ? current.filter((id) => id !== channelId)
                : [...current, channelId]
        );
    };

    const sendDockMessage = async (channelId: bigint, content: string, parentMessageId: bigint = 0n) => {
        const trimmed = content.trim();
        if (!trimmed) return;
        try {
            await sendMessageReducer({
                channelId,
                content: trimmed,
                parentMessageId,
            });
        } catch (error) {
            console.error('Failed to send dock message', error);
            toast.error(error instanceof Error ? error.message : 'Could not send message');
        }
    };

    const handleToggleReaction = async (messageId: bigint, emoji: string) => {
        try {
            await toggleReactionReducer({ messageId, emoji });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update reaction');
        }
    };

    const handleEditMessage = async (messageId: bigint, content: string) => {
        try {
            await editMessageReducer({ messageId, content });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not edit message');
            throw error;
        }
    };

    const openThreadForChannel = (channelId: bigint, messageId: bigint) => {
        setMinimizedWindowIds((current) => current.filter((id) => id !== channelId));
        setActiveThreadParentByChannel((current) => ({
            ...current,
            [String(channelId)]: messageId,
        }));
    };

    const closeThreadForChannel = (channelId: bigint) => {
        setActiveThreadParentByChannel((current) => ({
            ...current,
            [String(channelId)]: null,
        }));
    };

    const openMemberChat = async (memberId: bigint) => {
        const existing = dmChannelByPeerId.get(String(memberId));
        if (existing) {
            openDmWindow(existing.id);
            return;
        }

        if (currentOrgId == null) {
            toast.error('Organization context missing');
            return;
        }

        try {
            await createChannelReducer({
                orgId: currentOrgId,
                name: 'Direct Message',
                type: 'dm',
                memberIds: [memberId],
            });
            setPendingPeerOpenId(memberId);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not open direct message');
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const audio = new Audio(messageSoundUrl);
        audio.preload = 'auto';
        audioRef.current = audio;
        return () => {
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (currentDbUser == null || myChannelIds.size === 0) return;

        const incoming = messages
            .filter(
                (message) =>
                    myChannelIds.has(String(message.channelId)) &&
                    message.senderId !== currentDbUser.id
            )
            .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

        if (incoming.length === 0) return;
        const newestIncomingAt = incoming[incoming.length - 1].createdAt;

        if (!hasHydratedMessagesRef.current) {
            hasHydratedMessagesRef.current = true;
            lastNotifiedMessageAtRef.current = newestIncomingAt;
            return;
        }

        const hasNewIncoming = incoming.some((message) => message.createdAt > lastNotifiedMessageAtRef.current);
        if (!hasNewIncoming) {
            if (newestIncomingAt > lastNotifiedMessageAtRef.current) {
                lastNotifiedMessageAtRef.current = newestIncomingAt;
            }
            return;
        }

        const shouldPlaySound =
            location.pathname !== '/chat' ||
            document.visibilityState !== 'visible' ||
            !document.hasFocus();

        if (shouldPlaySound) {
            const audio = audioRef.current;
            if (audio) {
                audio.currentTime = 0;
                void audio.play().catch(() => {
                    // Browsers may block autoplay until user interaction.
                });
            }
        }

        const isAway =
            document.visibilityState !== 'visible' ||
            !document.hasFocus() ||
            currentPresence?.status === 'away';

        if (isAway && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const newestIncoming = [...incoming]
                .reverse()
                .find((message) => message.createdAt > lastNotifiedMessageAtRef.current) || null;

            const showSystemNotification = async () => {
                if (!newestIncoming) return;

                const senderName = userById.get(String(newestIncoming.senderId))?.name || 'New message';
                const channel = channels.find((row) => row.id === newestIncoming.channelId) || null;
                const isGroup = channel?.type !== 'dm';
                const title = isGroup ? `#${channel?.name || 'Channel'}` : senderName;
                const bodySource = newestIncoming.content.trim() || 'Sent you a message';
                const body = bodySource.length > 120 ? `${bodySource.slice(0, 117)}...` : bodySource;
                await triggerSystemNotification(title, body, `timey-chat-${String(newestIncoming.channelId)}`);
            };

            void showSystemNotification();
        }

        lastNotifiedMessageAtRef.current = newestIncomingAt;
    }, [channels, currentDbUser, currentPresence?.status, location.pathname, messages, myChannelIds, navigate, userById]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!isActive || currentDbUser == null) return;
        if (location.pathname.startsWith('/chat')) return;

        const sendHeartbeat = (status: string) => {
            void heartbeatReducer({
                orgId: currentOrgId ?? 0n,
                channelId: 0n,
                status,
            }).catch(() => {
                // Presence heartbeat is best-effort.
            });
        };

        sendHeartbeat(document.hidden ? 'away' : 'online');

        const interval = window.setInterval(() => {
            sendHeartbeat(document.hidden ? 'away' : 'online');
        }, 20_000);

        const onVisibilityChange = () => {
            sendHeartbeat(document.hidden ? 'away' : 'online');
        };

        const onUnload = () => {
            sendHeartbeat('offline');
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('beforeunload', onUnload);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [currentDbUser, currentOrgId, heartbeatReducer, isActive, location.pathname]);

    useEffect(() => {
        const validChannelIds = new Set(dockChannels.map((channel) => channel.id));
        const validChannelIdKeys = new Set(dockChannels.map((channel) => String(channel.id)));
        setOpenDmWindowIds((current) => current.filter((channelId) => validChannelIds.has(channelId)));
        setMinimizedWindowIds((current) => current.filter((channelId) => validChannelIds.has(channelId)));
        setActiveThreadParentByChannel((current) => {
            const next: Record<string, bigint | null> = {};
            for (const [key, value] of Object.entries(current)) {
                if (validChannelIdKeys.has(key)) {
                    next[key] = value;
                }
            }
            return next;
        });
    }, [dockChannels]);

    useEffect(() => {
        if (pendingPeerOpenId == null) return;
        const channel = dmChannelByPeerId.get(String(pendingPeerOpenId));
        if (channel) {
            openDmWindow(channel.id);
            setPendingPeerOpenId(null);
        }
    }, [dmChannelByPeerId, pendingPeerOpenId]);

    useEffect(() => {
        if (currentDbUser == null) return;

        for (const channelId of openDmWindowIds) {
            if (minimizedWindowIds.includes(channelId)) continue;
            const rows = dockMessagesByChannel.get(String(channelId)) || [];
            const lastMessage = rows[rows.length - 1];
            const marker = `${String(channelId)}:${String(lastMessage?.id || 0n)}`;
            if (lastMarkedDockReadRef.current[String(channelId)] === marker) continue;
            lastMarkedDockReadRef.current[String(channelId)] = marker;

            void markChannelReadReducer({ channelId }).catch(() => {
                // Dock read receipts are best-effort.
            });
        }
    }, [currentDbUser, dockMessagesByChannel, markChannelReadReducer, minimizedWindowIds, openDmWindowIds]);

    const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
    };

    const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
    };

    const triggerSystemNotification = async (title: string, body: string, tag: string): Promise<boolean> => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
        if (!window.isSecureContext || Notification.permission !== 'granted') return false;

        return await new Promise<boolean>((resolve) => {
            let settled = false;
            try {
                const notification = new Notification(title, {
                    body,
                    tag,
                    renotify: true,
                    requireInteraction: true,
                    silent: false,
                });

                const finish = (ok: boolean) => {
                    if (settled) return;
                    settled = true;
                    resolve(ok);
                };

                notification.onshow = () => finish(true);
                notification.onerror = () => finish(false);
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    void navigate({ to: '/chat' });
                };

                window.setTimeout(() => notification.close(), 10_000);
                window.setTimeout(() => finish(false), 1500);
            } catch {
                resolve(false);
            }
        });
    };

    const handleNotificationsClick = () => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') {
            toast.error('System notifications are not supported in this browser.');
            return;
        }
        if (!window.isSecureContext) {
            toast.error('Notifications require a secure context (HTTPS or localhost).');
            return;
        }
        if (Notification.permission === 'granted') {
            toast.success('System notifications already enabled.');
            return;
        }
        void Notification.requestPermission()
            .then((permission) => {
                if (permission === 'granted') {
                    toast.success('System notifications enabled.');
                } else if (permission === 'denied') {
                    toast.error('Notifications blocked. Enable them in browser settings.');
                } else {
                    toast.message('Notification permission was dismissed.');
                }
            })
            .catch(() => {
                toast.error('Could not request notification permission.');
            });
    };

    const dockVisible = !location.pathname.startsWith('/chat');
    const dockInset = dockVisible && !isMessengerMinimized ? 336 : 0;
    const openDmWindows = openDmWindowIds
        .map((channelId) => dockChannels.find((channel) => channel.id === channelId) || null)
        .filter((channel): channel is DbChatChannel => channel != null);
    const openWindowIdSet = useMemo(
        () => new Set(openDmWindowIds.map((channelId) => String(channelId))),
        [openDmWindowIds]
    );

    const isPeerOnline = (peerId: bigint | null) => {
        if (peerId == null) return false;
        const presence = presenceByUser.get(String(peerId));
        if (!presence || presence.status === 'offline') return false;
        return Date.now() - Number(presence.lastSeenAt) < 90_000;
    };

    const avatarColorForName = (name: string) => {
        const colors = ['#1f2937', '#374151', '#334155', '#0f766e', '#1e3a8a', '#4c1d95'];
        const index = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#000000', color: '#ffffff', overflow: 'hidden' }}>
            {/* Global Sidebar (Narrow) */}
            <Box
                sx={{
                    width: 68,
                    borderRight: '1px solid #1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 2,
                    gap: 1.5,
                }}
            >
                <SideItem
                    icon={GridViewRoundedIcon}
                    label="Projects"
                    active={location.pathname === '/' || location.pathname.startsWith('/projects')}
                    onClick={() => navigate({ to: '/' })}
                />
                <SideItem
                    icon={ChatOutlinedIcon}
                    label="Chat"
                    active={location.pathname.startsWith('/chat')}
                    onClick={() => navigate({ to: '/chat' })}
                />
                <SideItem
                    icon={AutoAwesomeOutlinedIcon}
                    label="AI"
                    active={location.pathname.startsWith('/ai')}
                    onClick={() => navigate({ to: '/' } as any)}
                />
                <Box sx={{ mt: 'auto' }}>
                    <SideItem
                        icon={SettingsOutlinedIcon}
                        label="Settings"
                        active={location.pathname.startsWith('/settings')}
                        onClick={() => navigate({ to: '/' } as any)}
                    />
                </Box>
            </Box>

            {/* Workspace Sidebar */}
            <Box
                sx={{
                    width: 250,
                    borderRight: '1px solid #1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    bgcolor: '#000000'
                }}
            >
                {/* Workspace Switcher */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' },
                        mb: 2,
                    }}
                >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: 1,
                                bgcolor: '#0070f3',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}
                        >
                            {orgName.charAt(0)}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {orgName}
                        </Typography>
                    </Stack>
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: '#666' }} />
                </Box>

                {chatSidebar ? (
                    /* Chat sidebar content */
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {chatSidebar}
                    </Box>
                ) : (
                    /* Default workspace nav */
                    <>
                        {/* View Projects */}
                        <Link to="/" style={{ textDecoration: 'none' }}>
                            <Button
                                variant="outlined"
                                startIcon={<GridViewRoundedIcon />}
                                fullWidth
                                sx={{
                                    justifyContent: 'flex-start',
                                    color: '#ffffff',
                                    borderColor: '#222',
                                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    py: 1,
                                    mb: 3,
                                    '&:hover': {
                                        borderColor: '#333',
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    },
                                }}
                            >
                                View projects
                            </Button>
                        </Link>

                        {/* Main Nav */}
                        <Stack spacing={0.5} sx={{ mb: 4 }}>
                            <WorkspaceNavItem icon={HomeOutlinedIcon} label="Home" to="/" />
                            <WorkspaceNavItem icon={PeopleOutlineRoundedIcon} label="Members" to="/members" />
                            <WorkspaceNavItem icon={ModeEditOutlineOutlinedIcon} label="Drafts" to="/drafts" />
                            <WorkspaceNavItem icon={PersonOutlineOutlinedIcon} label="Your work" to="/work" />
                            <WorkspaceNavItem icon={TurnedInNotOutlinedIcon} label="Stickies" to="/stickies" />
                        </Stack>

                        {/* Workspace Groups */}
                        <Box>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#666',
                                    fontWeight: 600,
                                    px: 1.5,
                                    mb: 1.5,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Workspace
                            </Typography>
                            <Stack spacing={0.5}>
                                <WorkspaceNavItem icon={BlurOnRoundedIcon} label="More" />
                            </Stack>
                        </Box>
                    </>
                )}

                {/* Branding (Bottom) */}
                <Box sx={{ mt: 'auto', p: 1, display: 'flex', justifyContent: 'center' }}>
                    <AppLogo size="small" color="#ffffff" />
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header / TopBar Integration */}
                <Box
                    sx={{
                        height: 56,
                        borderBottom: '1px solid #1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 3,
                        bgcolor: '#000000'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ color: '#858585', fontWeight: 500 }}>
                            {orgName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#444' }}>/</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                                {location.pathname === '/' ? 'Home' : location.pathname.split('/')[1]?.charAt(0).toUpperCase() + location.pathname.split('/')[1]?.slice(1)}
                            </Typography>
                        </Stack>
                    </Box>

                    {/* Search */}
                    <Box
                        sx={{
                            flex: 0.5,
                            maxWidth: 400,
                            bgcolor: '#111',
                            borderRadius: 2,
                            px: 1.5,
                            py: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid #222',
                        }}
                    >
                        <SearchIcon sx={{ color: '#666', fontSize: 18, mr: 1 }} />
                        <InputBase
                            placeholder=""
                            fullWidth
                            sx={{
                                color: '#ffffff',
                                fontSize: '0.85rem',
                            }}
                        />
                    </Box>

                    {/* Actions */}
                    <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton size="small" sx={{ color: '#858585' }} onClick={handleNotificationsClick}>
                            <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                        <IconButton size="small" sx={{ color: '#858585' }}>
                            <HelpOutlineOutlinedIcon sx={{ fontSize: 20 }} />
                        </IconButton>

                        {/* User Profile & Menu */}
                        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ ml: 1 }}>
                            <Stack direction="row" spacing={0.55} alignItems="center">
                                <Box
                                    sx={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        bgcolor: userStatusColor,
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: userStatusColor,
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        lineHeight: 1,
                                    }}
                                >
                                    {userStatusLabel}
                                </Typography>
                            </Stack>

                            <Tooltip title="User Profile">
                                <IconButton
                                    onClick={handleUserMenuOpen}
                                    sx={{ p: 0.5, border: '1px solid #333' }}
                                >
                                    <Avatar
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: '#2e7d32',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {email?.charAt(0).toUpperCase() || 'L'}
                                    </Avatar>
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Menu
                            anchorEl={userMenuAnchor}
                            open={Boolean(userMenuAnchor)}
                            onClose={handleUserMenuClose}
                            PaperProps={{
                                sx: {
                                    bgcolor: '#111',
                                    border: '1px solid #222',
                                    color: '#ffffff',
                                    minWidth: 180,
                                    mt: 1,
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.85rem',
                                        py: 1,
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' }
                                    }
                                }
                            }}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            <Box sx={{ px: 2, py: 1 }}>
                                <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                                    Signed in as
                                </Typography>
                                <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#fff' }}>
                                    {email}
                                </Typography>
                                <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.5 }}>
                                    <Box
                                        sx={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: '50%',
                                            bgcolor: userStatusColor,
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ color: userStatusColor, fontWeight: 600 }}>
                                        {userStatusLabel}
                                    </Typography>
                                </Stack>
                            </Box>
                            <Divider sx={{ borderColor: '#222' }} />
                            <MenuItem onClick={() => { handleUserMenuClose(); onLogout?.(); }}>
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: '#ff4d4d' }}>
                                    <LogoutRoundedIcon sx={{ fontSize: 18 }} />
                                    <Typography variant="inherit">Logout</Typography>
                                </Stack>
                            </MenuItem>
                        </Menu>
                    </Stack>
                </Box>

                {/* Content */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        pr: `${dockInset}px`,
                        transition: 'padding-right 0.2s ease',
                    }}
                >
                    {children}
                </Box>
            </Box>

            {dockVisible && (
                <>
                    {openDmWindows.map((channel, index) => {
                        const channelIdKey = String(channel.id);
                        const allRowsForChannel = dockMessageRowsByChannel.get(channelIdKey) || [];
                        const rootRows = dockRootRowsByChannel.get(channelIdKey) || [];
                        const replyCounts = replyCountByMessageByChannel.get(channelIdKey) || {};
                        const repliesByParent = dockRepliesByParentByChannel.get(channelIdKey) || new Map<string, DockMessageRow[]>();
                        const mentionUsers = mentionUsersByChannel.get(channelIdKey) || [];
                        const activeThreadParentId = activeThreadParentByChannel[channelIdKey] ?? null;
                        const activeThreadRoot = activeThreadParentId == null
                            ? null
                            : allRowsForChannel.find((row) => row.id === activeThreadParentId) || null;
                        const threadRows = activeThreadRoot
                            ? repliesByParent.get(String(activeThreadRoot.id)) || []
                            : [];
                        const activeThreadSender = activeThreadRoot
                            ? userById.get(String(activeThreadRoot.sender_id)) || null
                            : null;
                        const isActiveThreadOwn =
                            currentDbUser != null &&
                            activeThreadRoot != null &&
                            activeThreadRoot.sender_id === currentDbUser.id;
                        const isThreadOpen = activeThreadRoot != null;
                        const peer = peerByDmChannel.get(channelIdKey) || null;
                        const isGroupChannel = channel.type !== 'dm';
                        const peerOnline = isPeerOnline(peer?.id ?? null);
                        const isWindowMinimized = minimizedWindowIds.includes(channel.id);
                        const windowWidth = 460;
                        const windowRight = 348 + index * 472;

                        return (
                            <Box
                                key={channelIdKey}
                                sx={{
                                    position: 'fixed',
                                    right: windowRight,
                                    bottom: 16,
                                    width: windowWidth,
                                    height: isWindowMinimized ? 44 : 560,
                                    borderRadius: 0,
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    bgcolor: 'rgba(5,5,5,0.78)',
                                    zIndex: 1290,
                                    boxShadow: '0 14px 34px rgba(0,0,0,0.52)',
                                    backdropFilter: 'blur(10px) saturate(120%)',
                                    WebkitBackdropFilter: 'blur(10px) saturate(120%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                }}
                            >
                                <Box
                                    onClick={() => {
                                        if (isWindowMinimized) {
                                            toggleWindowMinimized(channel.id);
                                        }
                                    }}
                                    sx={{
                                        px: 1.1,
                                        py: 0.85,
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        bgcolor: 'rgba(5,5,5,0.72)',
                                        cursor: isWindowMinimized ? 'pointer' : 'default',
                                    }}
                                >
                                    <Stack direction="row" spacing={0.8} alignItems="center">
                                        <Avatar
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                bgcolor: avatarColorForName(peer?.name || channel.name),
                                            }}
                                        >
                                            {(peer?.name || channel.name).charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box>
                                            <Typography sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>
                                                {isGroupChannel ? `# ${channel.name}` : (peer?.name || channel.name)}
                                            </Typography>
                                            {isGroupChannel ? (
                                                <Typography sx={{ color: '#777', fontSize: '0.62rem', lineHeight: 1.2 }}>
                                                    Group channel
                                                </Typography>
                                            ) : (
                                                <Typography sx={{ color: peerOnline ? '#34d399' : '#777', fontSize: '0.62rem', lineHeight: 1.2 }}>
                                                    {peerOnline ? 'Online' : 'Offline'}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                    <Stack direction="row" spacing={0.2}>
                                        <IconButton
                                            size="small"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleWindowMinimized(channel.id);
                                            }}
                                            sx={{ color: '#858585', width: 24, height: 24 }}
                                        >
                                            <MinimizeRoundedIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                closeDmWindow(channel.id);
                                            }}
                                            sx={{ color: '#858585', width: 24, height: 24 }}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Stack>
                                </Box>

                                {!isWindowMinimized && (
                                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(9,9,9,0.56)' }}>
                                        {isThreadOpen ? (
                                            <>
                                                <Box
                                                    sx={{
                                                        px: 1.1,
                                                        py: 0.75,
                                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        bgcolor: 'rgba(5,5,5,0.5)',
                                                    }}
                                                >
                                                    <Stack direction="row" spacing={0.45} alignItems="center">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => closeThreadForChannel(channel.id)}
                                                            sx={{ color: '#9ec0ff', width: 22, height: 22 }}
                                                        >
                                                            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                        <Box>
                                                            <Typography sx={{ color: '#ffffff', fontSize: '0.73rem', fontWeight: 700 }}>
                                                                Thread
                                                            </Typography>
                                                            <Typography sx={{ color: '#777', fontSize: '0.63rem' }}>
                                                                {threadRows.length} repl{threadRows.length === 1 ? 'y' : 'ies'}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Box>

                                                <Box sx={{ px: 1.2, py: 0.82, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <Stack direction="row" spacing={0.6} alignItems="baseline" sx={{ mb: 0.35 }}>
                                                        <Typography sx={{ color: '#ffffff', fontSize: '0.71rem', fontWeight: 700 }}>
                                                            {activeThreadSender?.name || 'Unknown'}
                                                        </Typography>
                                                        {isActiveThreadOwn && (
                                                            <Typography sx={{ color: '#74a7ff', fontSize: '0.63rem', fontWeight: 700 }}>
                                                                You
                                                            </Typography>
                                                        )}
                                                        <Typography sx={{ color: '#777', fontSize: '0.61rem' }}>
                                                            {activeThreadRoot
                                                                ? new Date(Number(activeThreadRoot.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                : ''}
                                                        </Typography>
                                                    </Stack>
                                                    <Typography sx={{ color: '#d8d8d8', fontSize: '0.73rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                                        {activeThreadRoot?.content || ''}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
                                                    <MessageList
                                                        messages={threadRows}
                                                        users={users}
                                                        currentUserId={currentDbUser?.id || null}
                                                        currentUserName={currentDbUser?.name || ''}
                                                        threadMode
                                                        reactionsByMessage={reactionsByMessage}
                                                        onToggleReaction={handleToggleReaction}
                                                        onEditMessage={handleEditMessage}
                                                    />
                                                </Box>

                                                <MessageInput
                                                    onSend={(content) => {
                                                        if (activeThreadRoot == null) return;
                                                        return sendDockMessage(channel.id, content, activeThreadRoot.id);
                                                    }}
                                                    channelId={channel.id}
                                                    channelName={channel.name}
                                                    mentionUsers={mentionUsers}
                                                    contextHint={`Replying in thread (${threadRows.length} repl${threadRows.length === 1 ? 'y' : 'ies'})`}
                                                    draftScope={`dock-thread-${channelIdKey}-${String(activeThreadRoot?.id || 0n)}`}
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
                                                    <MessageList
                                                        messages={rootRows}
                                                        users={users}
                                                        currentUserId={currentDbUser?.id || null}
                                                        currentUserName={currentDbUser?.name || ''}
                                                        reactionsByMessage={reactionsByMessage}
                                                        replyCountByMessage={replyCounts}
                                                        onToggleReaction={handleToggleReaction}
                                                        onOpenThread={(messageId) => openThreadForChannel(channel.id, messageId)}
                                                        onReply={(message) => openThreadForChannel(channel.id, message.id)}
                                                        onEditMessage={handleEditMessage}
                                                    />
                                                </Box>
                                                <MessageInput
                                                    onSend={(content) => sendDockMessage(channel.id, content, 0n)}
                                                    channelId={channel.id}
                                                    channelName={channel.name}
                                                    mentionUsers={mentionUsers}
                                                    draftScope={`dock-main-${channelIdKey}`}
                                                />
                                            </>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}

                    <Box
                        sx={{
                            position: 'fixed',
                            right: 16,
                            ...(isMessengerMinimized ? { bottom: 16 } : { top: 72, bottom: 16 }),
                            width: 320,
                            borderRadius: 0,
                            border: '1px solid rgba(255,255,255,0.12)',
                            bgcolor: 'rgba(5,5,5,0.8)',
                            zIndex: 1310,
                            overflow: 'hidden',
                            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                            backdropFilter: 'blur(10px) saturate(120%)',
                            WebkitBackdropFilter: 'blur(10px) saturate(120%)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Box
                            onClick={() => {
                                if (isMessengerMinimized) {
                                    setIsMessengerMinimized(false);
                                }
                            }}
                            sx={{
                                px: 1.3,
                                py: 0.85,
                                bgcolor: 'rgba(17,17,17,0.7)',
                                color: chatColors.textPrimary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                cursor: isMessengerMinimized ? 'pointer' : 'default',
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography sx={{ color: chatColors.textPrimary, fontWeight: 700, fontSize: '0.84rem' }}>
                                    Messages
                                </Typography>
                                {totalUnread > 0 && (
                                    <Badge
                                        badgeContent={totalUnread}
                                        color="error"
                                        sx={{
                                            '& .MuiBadge-badge': {
                                                fontSize: '0.62rem',
                                                minWidth: 16,
                                                height: 16,
                                            },
                                        }}
                                    />
                                )}
                            </Stack>
                            <IconButton
                                size="small"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setIsMessengerMinimized((current) => !current);
                                }}
                                sx={{ color: chatColors.textSecondary, width: 24, height: 24 }}
                            >
                                <MinimizeRoundedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Box>

                        {!isMessengerMinimized && (
                            <>
                        <Box sx={{ px: 1, py: 0.85, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(5,5,5,0.62)' }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.7,
                                    px: 1.5,
                                    py: 0.6,
                                    borderRadius: 1.5,
                                    bgcolor: 'rgba(17,17,17,0.72)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    '&:focus-within': { borderColor: chatColors.borderHover },
                                }}
                            >
                                <SearchIcon sx={{ color: chatColors.textFaint, fontSize: 16 }} />
                                <InputBase
                                    value={messengerSearch}
                                    onChange={(event) => setMessengerSearch(event.target.value)}
                                    placeholder="Search chats..."
                                    sx={{ color: chatColors.textPrimary, fontSize: '0.8rem', width: '100%' }}
                                />
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                px: 1.2,
                                py: 0.72,
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                bgcolor: 'rgba(5,5,5,0.58)',
                            }}
                        >
                            <Typography
                                sx={{
                                    color: chatColors.textMuted,
                                    fontWeight: 700,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    fontSize: '0.62rem',
                                }}
                            >
                                Direct Messages
                            </Typography>
                        </Box>

                        <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'rgba(5,5,5,0.45)' }}>
                            {messengerContacts.length === 0 && messengerGroups.length === 0 ? (
                                <Box sx={{ px: 2, py: 2.2 }}>
                                    <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.75rem' }}>
                                        No conversations found.
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    {messengerContacts.map((contact) => {
                                        const peer = contact.member;
                                        const lastMessage = contact.lastMessage;
                                        const online = isPeerOnline(peer.id);
                                        const preview = lastMessage?.content || 'Start a conversation';
                                        const selected = contact.dmChannel != null && openWindowIdSet.has(String(contact.dmChannel.id));
                                        const timeLabel = lastMessage
                                            ? new Date(Number(lastMessage.createdAt)).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                            : '';
                                        return (
                                            <Box
                                                key={String(peer.id)}
                                                onClick={() => void openMemberChat(peer.id)}
                                                sx={{
                                                    px: 1.5,
                                                    py: 0.9,
                                                    mx: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.15,
                                                    cursor: 'pointer',
                                                    borderRadius: 1.5,
                                                    bgcolor: selected ? chatColors.selection : 'transparent',
                                                    '&:hover': {
                                                        bgcolor: selected ? chatColors.selectionStrong : chatColors.hover,
                                                    },
                                                }}
                                            >
                                                <Box sx={{ position: 'relative' }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 34,
                                                            height: 34,
                                                            fontSize: '0.76rem',
                                                            fontWeight: 700,
                                                            bgcolor: avatarColorForName(peer.name),
                                                        }}
                                                    >
                                                        {peer.name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    {online && (
                                                        <Box
                                                            sx={{
                                                                position: 'absolute',
                                                                right: -1,
                                                                bottom: -1,
                                                                width: 9,
                                                                height: 9,
                                                                borderRadius: '50%',
                                                                bgcolor: chatColors.success,
                                                                border: `1px solid ${chatColors.panelBg}`,
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0, pr: 0.7 }}>
                                                    <Typography sx={{ color: selected ? chatColors.textPrimary : '#d0d0d0', fontSize: '0.82rem', fontWeight: selected ? 700 : 500 }}>
                                                        {peer.name}
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            color: contact.unreadCount > 0 ? chatColors.textPrimary : chatColors.textMuted,
                                                            fontSize: '0.69rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            fontWeight: contact.unreadCount > 0 ? 600 : 400,
                                                        }}
                                                    >
                                                        {preview}
                                                    </Typography>
                                                </Box>
                                                <Stack spacing={0.35} alignItems="flex-end" sx={{ minWidth: 28 }}>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.65rem' }}>
                                                        {timeLabel}
                                                    </Typography>
                                                    {contact.unreadCount > 0 && (
                                                        <Box
                                                            sx={{
                                                            minWidth: 16,
                                                            height: 16,
                                                            px: 0.4,
                                                            borderRadius: 999,
                                                            bgcolor: chatColors.danger,
                                                            color: chatColors.textPrimary,
                                                            fontSize: '0.62rem',
                                                            fontWeight: 700,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                        }}
                                                        >
                                                            {contact.unreadCount}
                                                        </Box>
                                                    )}
                                                </Stack>
                                            </Box>
                                        );
                                    })}

                                    {messengerGroups.length > 0 && (
                                        <Box
                                            sx={{
                                                px: 1.2,
                                                py: 0.72,
                                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                                bgcolor: 'rgba(5,5,5,0.58)',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    color: chatColors.textMuted,
                                                    fontWeight: 700,
                                                    display: 'block',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.07em',
                                                    fontSize: '0.62rem',
                                                }}
                                            >
                                                Group Channels
                                            </Typography>
                                        </Box>
                                    )}

                                    {messengerGroups.map((group) => {
                                        const channel = group.channel;
                                        const preview = group.lastMessage?.content || 'Open group channel';
                                        const selected = openWindowIdSet.has(String(channel.id));
                                        const timeLabel = group.lastMessage
                                            ? new Date(Number(group.lastMessage.createdAt)).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                            : '';
                                        return (
                                            <Box
                                                key={String(channel.id)}
                                                onClick={() => openDmWindow(channel.id)}
                                                sx={{
                                                    px: 1.5,
                                                    py: 0.9,
                                                    mx: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.15,
                                                    cursor: 'pointer',
                                                    borderRadius: 1.5,
                                                    bgcolor: selected ? chatColors.selection : 'transparent',
                                                    '&:hover': {
                                                        bgcolor: selected ? chatColors.selectionStrong : chatColors.hover,
                                                    },
                                                }}
                                            >
                                                <Avatar
                                                    sx={{
                                                        width: 30,
                                                        height: 30,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        bgcolor: chatColors.border,
                                                    }}
                                                >
                                                    #
                                                </Avatar>
                                                <Box sx={{ flex: 1, minWidth: 0, pr: 0.7 }}>
                                                    <Typography sx={{ color: selected ? chatColors.textPrimary : '#d0d0d0', fontSize: '0.82rem', fontWeight: selected ? 700 : 500 }}>
                                                        {channel.name}
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            color: group.unreadCount > 0 ? chatColors.textPrimary : chatColors.textMuted,
                                                            fontSize: '0.69rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            fontWeight: group.unreadCount > 0 ? 600 : 400,
                                                        }}
                                                    >
                                                        {preview}
                                                    </Typography>
                                                </Box>
                                                <Stack spacing={0.35} alignItems="flex-end" sx={{ minWidth: 28 }}>
                                                    <Typography sx={{ color: chatColors.textMuted, fontSize: '0.65rem' }}>
                                                        {timeLabel}
                                                    </Typography>
                                                    {group.unreadCount > 0 && (
                                                        <Box
                                                            sx={{
                                                            minWidth: 16,
                                                            height: 16,
                                                            px: 0.4,
                                                            borderRadius: 999,
                                                            bgcolor: chatColors.actionBg,
                                                            color: chatColors.actionText,
                                                            fontSize: '0.62rem',
                                                            fontWeight: 700,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                        }}
                                                        >
                                                            {group.unreadCount}
                                                        </Box>
                                                    )}
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </>
                            )}
                        </Box>
                            </>
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
}
