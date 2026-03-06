import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputBase from '@mui/material/InputBase';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { toast } from 'sonner';
import { useSpacetimeDBQuery, useReducer } from 'spacetimedb/tanstack';
import { tables, reducers } from '../../module_bindings';
import type {
    ChatChannel as DbChatChannel,
    ChatChannelMember as DbChatChannelMember,
    ChatMessage as DbChatMessage,
    ChatReaction as DbChatReaction,
    ChatReadState as DbChatReadState,
    ChatTyping as DbChatTyping,
    OrganizationMember as DbOrganizationMember,
    User as DbUser,
    UserPresence as DbUserPresence,
} from '../../module_bindings/types';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { ChatSidebar } from './ChatSidebar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface SidebarChannel {
    id: bigint;
    name: string;
    type: string;
    created_at: bigint;
}

interface SidebarMessage {
    id: bigint;
    channel_id: bigint;
    sender_id: bigint;
    content: string;
    created_at: bigint;
}

function formatPresenceLabel(presence: DbUserPresence | null, fallbackLastSeen: bigint): string {
    const now = Date.now();
    const lastSeen = Number(presence?.lastSeenAt ?? fallbackLastSeen);
    const status = presence?.status || 'offline';

    if (status === 'offline') {
        const delta = now - lastSeen;
        if (delta < 5 * 60_000) return 'Just now';
        if (delta < 60 * 60_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
        if (delta < 24 * 60 * 60_000) return `${Math.floor(delta / 3_600_000)}h ago`;
        return `${Math.floor(delta / 86_400_000)}d ago`;
    }

    if (status === 'dnd') return 'Do not disturb';
    if (status === 'away') return 'Away';
    return 'Online';
}

function isOnline(presence: DbUserPresence | null, fallbackLastSeen: bigint): boolean {
    const status = presence?.status || 'offline';
    if (status === 'offline') return false;
    const lastSeen = Number(presence?.lastSeenAt ?? fallbackLastSeen);
    return Date.now() - lastSeen < 90_000;
}

export function ChatPage() {
    const { isAuthenticated } = useAuth();
    const { memberships } = useOrganizationMembership({ enabled: isAuthenticated });

    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allMessages] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_message : 'skip');
    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allMemberships] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allReactions] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_reaction : 'skip');
    const [allReadStates] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_read_state : 'skip');
    const [allTypingRows] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_typing : 'skip');
    const [allPresenceRows] = useSpacetimeDBQuery(isAuthenticated ? tables.user_presence : 'skip');

    const createChannel = useReducer(reducers.createChannel);
    const sendMessageReducer = useReducer(reducers.sendMessage);
    const addChannelMemberReducer = useReducer(reducers.addChannelMember);
    const heartbeatReducer = useReducer(reducers.heartbeat);
    const setTypingReducer = useReducer(reducers.setTyping);
    const markChannelReadReducer = useReducer(reducers.markChannelRead);
    const toggleReactionReducer = useReducer(reducers.toggleReaction);
    const editMessageReducer = useReducer(reducers.editMessage);

    const [selectedChannelId, setSelectedChannelId] = useState<bigint | null>(null);
    const [newChatOpen, setNewChatOpen] = useState(false);
    const [newGroupOpen, setNewGroupOpen] = useState(false);
    const [newDmSearch, setNewDmSearch] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<bigint[]>([]);
    const [messageSearch, setMessageSearch] = useState('');
    const [showMembersPanel, setShowMembersPanel] = useState(true);
    const [addMembersOpen, setAddMembersOpen] = useState(false);
    const [selectedInviteMemberIds, setSelectedInviteMemberIds] = useState<bigint[]>([]);
    const [activeThreadParentId, setActiveThreadParentId] = useState<bigint | null>(null);
    const [composerTyping, setComposerTyping] = useState(false);

    const lastMarkedReadRef = useRef<string>('');
    const typingSyncRef = useRef<string>('');

    const orgId = memberships?.[0]?.orgId ?? null;

    const channels = (allChannels || []) as DbChatChannel[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const messages = (allMessages || []) as DbChatMessage[];
    const users = (allUsers || []) as DbUser[];
    const membershipsForAllUsers = (allMemberships || []) as DbOrganizationMember[];
    const reactions = (allReactions || []) as DbChatReaction[];
    const readStates = (allReadStates || []) as DbChatReadState[];
    const typingRows = (allTypingRows || []) as DbChatTyping[];
    const presenceRows = (allPresenceRows || []) as DbUserPresence[];

    const currentUser = useMemo(() => {
        const member = memberships[0];
        if (!member) return null;
        return users.find((u) => u.id === member.userId) || null;
    }, [memberships, users]);

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
            const key = String(msg.channelId);
            const existing = map.get(key);
            if (!existing || Number(msg.createdAt) > Number(existing.createdAt)) {
                map.set(key, msg);
            }
        }
        return map;
    }, [messages]);

    const myChannels = useMemo(() => {
        if (currentUser == null || orgId == null) return [];
        const mine = new Set(
            channelMembers
                .filter((row) => row.userId === currentUser.id)
                .map((row) => String(row.channelId))
        );

        return channels
            .filter((channel) => channel.orgId === orgId && mine.has(String(channel.id)))
            .sort((a, b) => {
                const aLast = lastMessageByChannel.get(String(a.id));
                const bLast = lastMessageByChannel.get(String(b.id));
                if (aLast && bLast) return Number(bLast.createdAt) - Number(aLast.createdAt);
                if (aLast) return -1;
                if (bLast) return 1;
                return Number(b.createdAt) - Number(a.createdAt);
            });
    }, [channelMembers, channels, currentUser, lastMessageByChannel, orgId]);

    useEffect(() => {
        if (myChannels.length === 0) {
            if (selectedChannelId !== null) setSelectedChannelId(null);
            return;
        }

        const hasSelected =
            selectedChannelId !== null && myChannels.some((channel) => channel.id === selectedChannelId);

        if (!hasSelected) {
            setSelectedChannelId(myChannels[0].id);
        }
    }, [myChannels, selectedChannelId]);

    const selectedChannel = useMemo(() => {
        if (selectedChannelId == null) return null;
        return myChannels.find((channel) => channel.id === selectedChannelId) || null;
    }, [myChannels, selectedChannelId]);

    const selectedChannelMessages = useMemo(() => {
        if (selectedChannelId == null) return [];
        return messages
            .filter((msg) => msg.channelId === selectedChannelId)
            .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
    }, [messages, selectedChannelId]);

    const selectedChannelMembers = useMemo(() => {
        if (selectedChannelId == null) return [];
        const rawMembers = channelMembersByChannel.get(String(selectedChannelId)) || [];
        return rawMembers
            .map((row) => userById.get(String(row.userId)) || null)
            .filter((row): row is DbUser => row != null)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [channelMembersByChannel, selectedChannelId, userById]);

    const orgMembers = useMemo(() => {
        if (orgId == null || currentUser == null) return [];

        const orgMemberIds = new Set(
            membershipsForAllUsers
                .filter((row) => row.orgId === orgId)
                .map((row) => String(row.userId))
        );

        return users
            .filter((user) => orgMemberIds.has(String(user.id)) && user.id !== currentUser.id)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [currentUser, membershipsForAllUsers, orgId, users]);

    const readStateByChannel = useMemo(() => {
        const map = new Map<string, DbChatReadState>();
        if (!currentUser) return map;

        for (const row of readStates) {
            if (row.userId !== currentUser.id) continue;
            const key = String(row.channelId);
            const existing = map.get(key);
            if (!existing || Number(row.lastReadAt) > Number(existing.lastReadAt)) {
                map.set(key, row);
            }
        }
        return map;
    }, [currentUser, readStates]);

    const unreadCountsByChannel = useMemo(() => {
        if (currentUser == null) return {};

        const counts: Record<string, number> = {};
        for (const channel of myChannels) {
            const key = String(channel.id);
            const readAt = Number(readStateByChannel.get(key)?.lastReadAt || 0n);
            const unread = messages.filter(
                (msg) =>
                    msg.channelId === channel.id &&
                    msg.senderId !== currentUser.id &&
                    Number(msg.createdAt) > readAt
            ).length;

            if (unread > 0) counts[key] = unread;
        }

        return counts;
    }, [currentUser, messages, myChannels, readStateByChannel]);

    const reactionsByMessage = useMemo(() => {
        const result: Record<string, { emoji: string; count: number; reactedByMe: boolean }[]> = {};
        if (currentUser == null) return result;

        const reactionBucket = new Map<string, { messageId: string; emoji: string; count: number; reactedByMe: boolean }>();

        for (const row of reactions) {
            if (!row.isActive) continue;
            const key = `${String(row.messageId)}::${row.emoji}`;
            const existing = reactionBucket.get(key);
            if (existing) {
                existing.count += 1;
                if (row.userId === currentUser.id) existing.reactedByMe = true;
            } else {
                reactionBucket.set(key, {
                    messageId: String(row.messageId),
                    emoji: row.emoji,
                    count: 1,
                    reactedByMe: row.userId === currentUser.id,
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
    }, [currentUser, reactions]);

    const repliesByParent = useMemo(() => {
        const map = new Map<string, DbChatMessage[]>();
        for (const msg of selectedChannelMessages) {
            if (msg.parentMessageId === 0n) continue;
            const key = String(msg.parentMessageId);
            const existing = map.get(key);
            if (existing) {
                existing.push(msg);
            } else {
                map.set(key, [msg]);
            }
        }
        for (const value of map.values()) {
            value.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
        }
        return map;
    }, [selectedChannelMessages]);

    const replyCountByMessage = useMemo(() => {
        const result: Record<string, number> = {};
        for (const [parentId, rows] of repliesByParent.entries()) {
            result[parentId] = rows.length;
        }
        return result;
    }, [repliesByParent]);

    const filteredChannelMessages = useMemo(() => {
        const q = messageSearch.trim().toLowerCase();
        if (!q) return selectedChannelMessages;
        return selectedChannelMessages.filter((msg) => {
            const senderName = userById.get(String(msg.senderId))?.name || '';
            return msg.content.toLowerCase().includes(q) || senderName.toLowerCase().includes(q);
        });
    }, [messageSearch, selectedChannelMessages, userById]);

    const mainChannelMessages = useMemo(
        () => filteredChannelMessages.filter((msg) => msg.parentMessageId === 0n),
        [filteredChannelMessages]
    );

    const activeThreadRootMessage = useMemo(() => {
        if (activeThreadParentId == null) return null;
        return selectedChannelMessages.find((msg) => msg.id === activeThreadParentId) || null;
    }, [activeThreadParentId, selectedChannelMessages]);

    const threadReplies = useMemo(() => {
        if (activeThreadParentId == null) return [];
        return repliesByParent.get(String(activeThreadParentId)) || [];
    }, [activeThreadParentId, repliesByParent]);

    const othersTyping = useMemo(() => {
        if (selectedChannelId == null || currentUser == null) return [];
        const now = Date.now();
        return typingRows
            .filter(
                (row) =>
                    row.channelId === selectedChannelId &&
                    row.userId !== currentUser.id &&
                    row.isTyping &&
                    now - Number(row.updatedAt) < 10_000
            )
            .map((row) => userById.get(String(row.userId))?.name || 'Someone');
    }, [currentUser, selectedChannelId, typingRows, userById]);

    const peerByChannel = useMemo(() => {
        const result: Record<string, bigint | null> = {};
        if (currentUser == null) return result;

        for (const channel of myChannels) {
            if (channel.type !== 'dm') continue;
            const channelRows = channelMembersByChannel.get(String(channel.id)) || [];
            const peer = channelRows.find((row) => row.userId !== currentUser.id) || null;
            result[String(channel.id)] = peer?.userId || null;
        }

        return result;
    }, [channelMembersByChannel, currentUser, myChannels]);

    const sidebarUsers = useMemo(() => {
        return users.map((user) => {
            const presence = presenceByUser.get(String(user.id));
            return {
                ...user,
                status: presence?.status,
                lastSeenAt: presence?.lastSeenAt,
                lastLoginAt: user.lastLoginAt,
            };
        });
    }, [presenceByUser, users]);

    const availableMembersToAdd = useMemo(() => {
        if (selectedChannel == null) return [];
        const existingMembers = new Set(
            (channelMembersByChannel.get(String(selectedChannel.id)) || []).map((row) => String(row.userId))
        );

        return orgMembers.filter((member) => !existingMembers.has(String(member.id)));
    }, [channelMembersByChannel, orgMembers, selectedChannel]);

    const filteredDmCandidates = useMemo(() => {
        const search = newDmSearch.trim().toLowerCase();
        if (!search) return orgMembers;
        return orgMembers.filter(
            (member) =>
                member.name.toLowerCase().includes(search) ||
                member.email.toLowerCase().includes(search)
        );
    }, [newDmSearch, orgMembers]);

    const lastSelectedMessageId = selectedChannelMessages[selectedChannelMessages.length - 1]?.id || null;

    useEffect(() => {
        if (selectedChannelId == null || currentUser == null) return;
        const markKey = `${String(selectedChannelId)}:${String(lastSelectedMessageId ?? 0n)}`;
        if (lastMarkedReadRef.current === markKey) return;
        lastMarkedReadRef.current = markKey;

        void markChannelReadReducer({ channelId: selectedChannelId }).catch(() => {
            // Keep UI responsive even if read receipts fail transiently.
        });
    }, [currentUser, lastSelectedMessageId, markChannelReadReducer, selectedChannelId]);

    useEffect(() => {
        if (!isAuthenticated || currentUser == null) return;

        const sendHeartbeat = (status: string) => {
            void heartbeatReducer({
                orgId: orgId ?? 0n,
                channelId: selectedChannelId ?? 0n,
                status,
            }).catch(() => {
                // Presence is best-effort.
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
    }, [currentUser, heartbeatReducer, isAuthenticated, orgId, selectedChannelId]);

    useEffect(() => {
        if (selectedChannelId == null || currentUser == null) return;

        const syncKey = `${String(selectedChannelId)}:${composerTyping ? '1' : '0'}`;
        if (typingSyncRef.current === syncKey) return;
        typingSyncRef.current = syncKey;

        const timer = window.setTimeout(() => {
            void setTypingReducer({ channelId: selectedChannelId, isTyping: composerTyping }).catch(() => {
                // Typing indicators are best-effort.
            });
        }, 180);

        return () => window.clearTimeout(timer);
    }, [composerTyping, currentUser, selectedChannelId, setTypingReducer]);

    useEffect(() => {
        setComposerTyping(false);
        typingSyncRef.current = '';
    }, [selectedChannelId]);

    const handleCreateDM = async (targetUserId: bigint) => {
        if (orgId == null || currentUser == null) return;

        const existing = myChannels.find((channel) => {
            if (channel.type !== 'dm') return false;
            return (channelMembersByChannel.get(String(channel.id)) || []).some(
                (row) => row.userId === targetUserId
            );
        });

        if (existing) {
            setSelectedChannelId(existing.id);
            setNewChatOpen(false);
            setNewDmSearch('');
            return;
        }

        const target = users.find((user) => user.id === targetUserId);
        try {
            await createChannel({
                orgId,
                name: target?.name || 'Direct Message',
                type: 'dm',
                memberIds: [targetUserId],
            });
            setNewChatOpen(false);
            setNewDmSearch('');
            toast.success('Direct message created');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create DM');
        }
    };

    const handleCreateGroup = async () => {
        if (orgId == null || !newChannelName.trim() || selectedMemberIds.length === 0) return;
        try {
            await createChannel({
                orgId,
                name: newChannelName.trim(),
                type: 'group',
                memberIds: selectedMemberIds,
            });
            setNewGroupOpen(false);
            setNewChannelName('');
            setSelectedMemberIds([]);
            toast.success('Group channel created');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create group');
        }
    };

    const handleAddMembersToChannel = async () => {
        if (selectedChannel == null || selectedInviteMemberIds.length === 0) return;

        try {
            for (const memberId of selectedInviteMemberIds) {
                await addChannelMemberReducer({ channelId: selectedChannel.id, userId: memberId });
            }
            setAddMembersOpen(false);
            setSelectedInviteMemberIds([]);
            toast.success('Members added to channel');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not add member');
        }
    };

    const handleSendMessage = async (content: string, parentMessageId: bigint = 0n) => {
        if (selectedChannelId == null) return;
        try {
            await sendMessageReducer({
                channelId: selectedChannelId,
                content,
                parentMessageId,
            });
            setComposerTyping(false);
            await setTypingReducer({ channelId: selectedChannelId, isTyping: false });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send message');
            throw err;
        }
    };

    const handleToggleReaction = async (messageId: bigint, emoji: string) => {
        try {
            await toggleReactionReducer({ messageId, emoji });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not add reaction');
        }
    };

    const handleEditMessage = async (messageId: bigint, content: string) => {
        try {
            await editMessageReducer({ messageId, content });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not edit message');
            throw err;
        }
    };

    const sidebarChannels: SidebarChannel[] = myChannels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        created_at: channel.createdAt,
    }));

    const sidebarMessages: SidebarMessage[] = messages.map((msg) => ({
        id: msg.id,
        channel_id: msg.channelId,
        sender_id: msg.senderId,
        content: msg.content,
        created_at: msg.createdAt,
    }));

    const messageListMessages = mainChannelMessages.map((msg) => ({
        id: msg.id,
        channel_id: msg.channelId,
        sender_id: msg.senderId,
        parent_message_id: msg.parentMessageId,
        content: msg.content,
        created_at: msg.createdAt,
        edited_at: msg.editedAt,
    }));

    const threadMessageRows = threadReplies.map((msg) => ({
        id: msg.id,
        channel_id: msg.channelId,
        sender_id: msg.senderId,
        parent_message_id: msg.parentMessageId,
        content: msg.content,
        created_at: msg.createdAt,
        edited_at: msg.editedAt,
    }));

    const channelHeaderSubtitle = selectedChannel
        ? selectedChannel.type === 'dm'
            ? 'Direct message'
            : `${selectedChannelMembers.length} members`
        : '';

    const dmUnreadTotal = Object.entries(unreadCountsByChannel)
        .filter(([channelId]) => {
            const channel = myChannels.find((candidate) => String(candidate.id) === channelId);
            return channel?.type === 'dm';
        })
        .reduce((acc, [, count]) => acc + count, 0);

    const groupUnreadTotal = Object.entries(unreadCountsByChannel)
        .filter(([channelId]) => {
            const channel = myChannels.find((candidate) => String(candidate.id) === channelId);
            return channel?.type !== 'dm';
        })
        .reduce((acc, [, count]) => acc + count, 0);

    return (
        <DashboardLayout
            chatSidebar={
                <ChatSidebar
                    channels={sidebarChannels}
                    selectedChannelId={selectedChannelId}
                    onSelectChannel={(channelId) => {
                        setSelectedChannelId(channelId);
                        setActiveThreadParentId(null);
                        void markChannelReadReducer({ channelId }).catch(() => {
                            // Ignore best-effort read receipt errors.
                        });
                    }}
                    onNewChat={() => setNewChatOpen(true)}
                    onNewGroup={() => setNewGroupOpen(true)}
                    users={sidebarUsers}
                    messages={sidebarMessages}
                    unreadCountsByChannel={unreadCountsByChannel}
                    peerByChannel={peerByChannel}
                />
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {selectedChannel ? (
                    <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                            <Box
                                sx={{
                                    px: 3,
                                    py: 1.25,
                                    borderBottom: '1px solid #1a1a1a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 2,
                                }}
                            >
                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                                    {selectedChannel.type === 'group' ? (
                                        <TagRoundedIcon sx={{ fontSize: 18, color: '#7f8db5' }} />
                                    ) : (
                                        <ChatOutlinedIcon sx={{ fontSize: 18, color: '#7f8db5' }} />
                                    )}
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                fontWeight: 700,
                                                color: '#fff',
                                                fontSize: '0.95rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {selectedChannel.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#677087', fontSize: '0.68rem' }}>
                                            {channelHeaderSubtitle}
                                        </Typography>
                                    </Box>
                                </Stack>

                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 220,
                                            maxWidth: '40vw',
                                            bgcolor: '#0f1219',
                                            border: '1px solid #222937',
                                            borderRadius: 1.5,
                                            px: 1.1,
                                            py: 0.55,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.8,
                                            '&:focus-within': { borderColor: '#5865F2' },
                                        }}
                                    >
                                        <SearchRoundedIcon sx={{ color: '#68708b', fontSize: 16 }} />
                                        <InputBase
                                            placeholder="Search messages"
                                            value={messageSearch}
                                            onChange={(event) => setMessageSearch(event.target.value)}
                                            sx={{ color: '#fff', fontSize: '0.8rem', width: '100%' }}
                                        />
                                    </Box>

                                    <Tooltip title="Threads">
                                        <IconButton
                                            onClick={() => {
                                                if (activeThreadParentId != null) {
                                                    setActiveThreadParentId(null);
                                                } else {
                                                    const firstRoot = mainChannelMessages[0];
                                                    if (firstRoot) setActiveThreadParentId(firstRoot.id);
                                                }
                                            }}
                                            sx={{
                                                color: activeThreadParentId ? '#dbe5ff' : '#7d869f',
                                                bgcolor: activeThreadParentId ? 'rgba(88,101,242,0.16)' : 'transparent',
                                                borderRadius: 1.5,
                                                '&:hover': { bgcolor: 'rgba(88,101,242,0.25)', color: '#fff' },
                                            }}
                                        >
                                            <ForumRoundedIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    </Tooltip>

                                    {selectedChannel.type !== 'dm' && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setAddMembersOpen(true)}
                                            startIcon={<PersonAddAlt1RoundedIcon />}
                                            sx={{
                                                borderColor: '#2a3142',
                                                color: '#b9c2d8',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderRadius: 1.5,
                                                '&:hover': { borderColor: '#4c5a84', color: '#fff' },
                                            }}
                                        >
                                            Add People
                                        </Button>
                                    )}

                                    <Tooltip title={showMembersPanel ? 'Hide members' : 'Show members'}>
                                        <IconButton
                                            onClick={() => setShowMembersPanel((current) => !current)}
                                            sx={{
                                                color: showMembersPanel ? '#dbe5ff' : '#7d869f',
                                                bgcolor: showMembersPanel ? 'rgba(88,101,242,0.16)' : 'transparent',
                                                borderRadius: 1.5,
                                                '&:hover': { bgcolor: 'rgba(88,101,242,0.25)', color: '#fff' },
                                            }}
                                        >
                                            <PeopleAltOutlinedIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            {messageSearch.trim() && (
                                <Box
                                    sx={{
                                        px: 3,
                                        py: 0.6,
                                        borderBottom: '1px solid #151823',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Typography variant="caption" sx={{ color: '#90a0c4', fontSize: '0.72rem' }}>
                                        {filteredChannelMessages.length} result{filteredChannelMessages.length === 1 ? '' : 's'}
                                        {' '}for "{messageSearch.trim()}"
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={() => setMessageSearch('')}
                                        sx={{ color: '#7f8db5', textTransform: 'none', minWidth: 0 }}
                                    >
                                        Clear
                                    </Button>
                                </Box>
                            )}

                            <MessageList
                                messages={messageListMessages}
                                users={users}
                                currentUserId={currentUser?.id || null}
                                currentUserName={currentUser?.name || ''}
                                searchTerm={messageSearch}
                                reactionsByMessage={reactionsByMessage}
                                replyCountByMessage={replyCountByMessage}
                                onToggleReaction={handleToggleReaction}
                                onOpenThread={(messageId) => setActiveThreadParentId(messageId)}
                                onEditMessage={handleEditMessage}
                            />

                            <Typography
                                variant="caption"
                                sx={{ px: 3, py: 0.4, color: '#7f8db5', fontSize: '0.72rem', minHeight: 18 }}
                            >
                                {othersTyping.length > 0
                                    ? `${othersTyping.slice(0, 3).join(', ')} ${othersTyping.length > 1 ? 'are' : 'is'} typing...`
                                    : composerTyping
                                        ? 'You are typing...'
                                        : ''}
                            </Typography>

                            <MessageInput
                                onSend={(content) => handleSendMessage(content, 0n)}
                                channelId={selectedChannel.id}
                                channelName={selectedChannel.name}
                                onTypingChange={setComposerTyping}
                                draftScope="main"
                            />
                        </Box>

                        {activeThreadRootMessage ? (
                            <Box
                                sx={{
                                    width: { xs: '100%', xl: 340 },
                                    borderLeft: '1px solid #1a1a1a',
                                    bgcolor: '#090b10',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 1.2,
                                        borderBottom: '1px solid #181c25',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ color: '#e0e6f7', fontSize: '0.86rem', fontWeight: 700 }}>
                                            Thread
                                        </Typography>
                                        <Typography sx={{ color: '#74809e', fontSize: '0.67rem' }}>
                                            #{selectedChannel.name}
                                        </Typography>
                                    </Box>
                                    <IconButton
                                        onClick={() => setActiveThreadParentId(null)}
                                        size="small"
                                        sx={{ color: '#7582a2' }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Box>

                                <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid #181c25' }}>
                                    <Typography sx={{ color: '#aeb8d3', fontSize: '0.72rem', mb: 0.45 }}>
                                        Original message
                                    </Typography>
                                    <Typography sx={{ color: '#d6dcef', fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {activeThreadRootMessage.content}
                                    </Typography>
                                </Box>

                                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                    <MessageList
                                        messages={threadMessageRows}
                                        users={users}
                                        currentUserId={currentUser?.id || null}
                                        currentUserName={currentUser?.name || ''}
                                        reactionsByMessage={reactionsByMessage}
                                        onToggleReaction={handleToggleReaction}
                                        onEditMessage={handleEditMessage}
                                    />
                                </Box>

                                <MessageInput
                                    onSend={(content) => handleSendMessage(content, activeThreadRootMessage.id)}
                                    channelId={selectedChannel.id}
                                    channelName={selectedChannel.name}
                                    contextHint={`Replying in thread (${threadReplies.length} repl${threadReplies.length === 1 ? 'y' : 'ies'})`}
                                    draftScope={`thread-${String(activeThreadRootMessage.id)}`}
                                    onTypingChange={setComposerTyping}
                                />
                            </Box>
                        ) : showMembersPanel ? (
                            <Box
                                sx={{
                                    width: 252,
                                    borderLeft: '1px solid #1a1a1a',
                                    bgcolor: '#090b10',
                                    display: { xs: 'none', lg: 'flex' },
                                    flexDirection: 'column',
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.6 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: '#7f8db5',
                                            fontWeight: 700,
                                            fontSize: '0.68rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                        }}
                                    >
                                        Members - {selectedChannelMembers.length}
                                    </Typography>
                                </Box>
                                <Divider sx={{ borderColor: '#181c25' }} />
                                <Stack spacing={0.45} sx={{ p: 1.5, overflowY: 'auto' }}>
                                    {selectedChannelMembers.map((member) => {
                                        const presence = presenceByUser.get(String(member.id)) || null;
                                        const online = isOnline(presence, member.lastLoginAt);
                                        return (
                                            <Box
                                                key={String(member.id)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    px: 1,
                                                    py: 0.7,
                                                    borderRadius: 1.25,
                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                                                }}
                                            >
                                                <Box sx={{ position: 'relative' }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 30,
                                                            height: 30,
                                                            bgcolor: '#1f2a38',
                                                            color: '#d6e4ff',
                                                            fontSize: '0.76rem',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    {online && (
                                                        <Box
                                                            sx={{
                                                                position: 'absolute',
                                                                right: -1,
                                                                bottom: -1,
                                                                width: 10,
                                                                height: 10,
                                                                borderRadius: '50%',
                                                                bgcolor: '#38c872',
                                                                border: '2px solid #090b10',
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: '#d5d9e7',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 600,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {member.name}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: '#7b849e', fontSize: '0.66rem' }}
                                                    >
                                                        {formatPresenceLabel(presence, member.lastLoginAt)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        ) : null}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            px: 3,
                            background: 'radial-gradient(circle at 40% 0%, rgba(88,101,242,0.16), rgba(0,0,0,0) 45%)',
                        }}
                    >
                        <Box
                            sx={{
                                width: 84,
                                height: 84,
                                borderRadius: 4,
                                bgcolor: 'rgba(88,101,242,0.13)',
                                border: '1px solid rgba(88,101,242,0.35)',
                                display: 'grid',
                                placeItems: 'center',
                            }}
                        >
                            <ChatOutlinedIcon sx={{ fontSize: 38, color: '#9cb0ff' }} />
                        </Box>
                        <Stack spacing={1} alignItems="center">
                            <Typography
                                variant="h5"
                                sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', textAlign: 'center' }}
                            >
                                Organization Chat
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Chip
                                    size="small"
                                    label={`${myChannels.length} channels`}
                                    sx={{ bgcolor: '#111827', color: '#9fb2dd', fontWeight: 600 }}
                                />
                                <Chip
                                    size="small"
                                    label={`${dmUnreadTotal} DM unread`}
                                    sx={{ bgcolor: '#111827', color: '#9fb2dd', fontWeight: 600 }}
                                />
                                <Chip
                                    size="small"
                                    label={`${groupUnreadTotal} group unread`}
                                    sx={{ bgcolor: '#111827', color: '#9fb2dd', fontWeight: 600 }}
                                />
                            </Stack>
                            <Typography
                                variant="body2"
                                sx={{ color: '#73809e', textAlign: 'center', maxWidth: 360, mt: 0.5 }}
                            >
                                Start direct messages, spin up group channels, keep teams online with live presence,
                                and use threaded replies plus reactions for cleaner context.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                variant="contained"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setNewChatOpen(true)}
                                sx={{
                                    bgcolor: '#5865F2',
                                    color: '#fff',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    px: 3,
                                    '&:hover': { bgcolor: '#4c59de' },
                                }}
                            >
                                New DM
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<GroupAddRoundedIcon />}
                                onClick={() => setNewGroupOpen(true)}
                                sx={{
                                    borderColor: '#2d3551',
                                    color: '#b6c2e6',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    px: 3,
                                    '&:hover': { borderColor: '#4e5a7e', color: '#fff' },
                                }}
                            >
                                New Group
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Box>

            <Dialog
                open={newChatOpen}
                onClose={() => {
                    setNewChatOpen(false);
                    setNewDmSearch('');
                }}
                PaperProps={{
                    sx: {
                        bgcolor: '#0b0d13',
                        border: '1px solid #252b3c',
                        borderRadius: 2,
                        minWidth: 360,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                    Start a direct message
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            border: '1px solid #252b3c',
                            borderRadius: 1.5,
                            px: 1.25,
                            py: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1.5,
                            mt: 0.5,
                            '&:focus-within': { borderColor: '#5865F2' },
                        }}
                    >
                        <SearchRoundedIcon sx={{ color: '#6f7893', fontSize: 17 }} />
                        <InputBase
                            placeholder="Search members"
                            value={newDmSearch}
                            onChange={(event) => setNewDmSearch(event.target.value)}
                            fullWidth
                            sx={{ color: '#fff', fontSize: '0.85rem' }}
                        />
                    </Box>
                    <Stack spacing={0.7} sx={{ maxHeight: 320, overflowY: 'auto' }}>
                        {filteredDmCandidates.map((member) => (
                            <Box
                                key={String(member.id)}
                                onClick={() => void handleCreateDM(member.id)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: 1.5,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(88,101,242,0.16)' },
                                }}
                            >
                                <Avatar
                                    sx={{
                                        width: 33,
                                        height: 33,
                                        bgcolor: '#1f2a38',
                                        color: '#d6e4ff',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                    }}
                                >
                                    {member.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#d9deed', fontWeight: 600 }}>
                                        {member.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#7782a1' }}>
                                        {member.email}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                        {filteredDmCandidates.length === 0 && (
                            <Typography variant="body2" sx={{ color: '#5f6881', textAlign: 'center', py: 2 }}>
                                No matching members found.
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => {
                            setNewChatOpen(false);
                            setNewDmSearch('');
                        }}
                        sx={{ color: '#7782a1', textTransform: 'none' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={newGroupOpen}
                onClose={() => setNewGroupOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#0b0d13',
                        border: '1px solid #252b3c',
                        borderRadius: 2,
                        minWidth: 380,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                    Create a group channel
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Channel name"
                        fullWidth
                        value={newChannelName}
                        onChange={(event) => setNewChannelName(event.target.value)}
                        placeholder="marketing, product, design..."
                        sx={{
                            mb: 2,
                            mt: 1,
                            '& .MuiInputBase-root': { color: '#fff', bgcolor: '#0f1219' },
                            '& .MuiInputLabel-root': { color: '#7782a1' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2d3550' },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: '#7b84a0', mb: 1, display: 'block' }}>
                        Select members ({selectedMemberIds.length} selected)
                    </Typography>
                    <Stack spacing={0.35} sx={{ maxHeight: 260, overflowY: 'auto' }}>
                        {orgMembers.map((member) => {
                            const checked = selectedMemberIds.includes(member.id);
                            return (
                                <FormControlLabel
                                    key={String(member.id)}
                                    sx={{ ml: 0.1 }}
                                    control={
                                        <Checkbox
                                            checked={checked}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedMemberIds((current) => [...current, member.id]);
                                                } else {
                                                    setSelectedMemberIds((current) =>
                                                        current.filter((id) => id !== member.id)
                                                    );
                                                }
                                            }}
                                            sx={{
                                                color: '#5f6881',
                                                '&.Mui-checked': { color: '#5865F2' },
                                            }}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" sx={{ color: '#d8deee' }}>
                                            {member.name}
                                        </Typography>
                                    }
                                />
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setNewGroupOpen(false)} sx={{ color: '#7782a1', textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleCreateGroup()}
                        disabled={!newChannelName.trim() || selectedMemberIds.length === 0}
                        variant="contained"
                        sx={{
                            bgcolor: '#5865F2',
                            color: '#fff',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#4c59de' },
                            '&.Mui-disabled': { bgcolor: '#2d3550', color: '#647092' },
                        }}
                    >
                        Create Group
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={addMembersOpen}
                onClose={() => {
                    setAddMembersOpen(false);
                    setSelectedInviteMemberIds([]);
                }}
                PaperProps={{
                    sx: {
                        bgcolor: '#0b0d13',
                        border: '1px solid #252b3c',
                        borderRadius: 2,
                        minWidth: 380,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                    Add members to {selectedChannel?.name || 'channel'}
                </DialogTitle>
                <DialogContent>
                    {availableMembersToAdd.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#7b84a0', py: 2 }}>
                            Everyone in this organization is already in this channel.
                        </Typography>
                    ) : (
                        <Stack spacing={0.35} sx={{ maxHeight: 260, overflowY: 'auto', mt: 0.5 }}>
                            {availableMembersToAdd.map((member) => {
                                const checked = selectedInviteMemberIds.includes(member.id);
                                return (
                                    <FormControlLabel
                                        key={String(member.id)}
                                        sx={{ ml: 0.1 }}
                                        control={
                                            <Checkbox
                                                checked={checked}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedInviteMemberIds((current) => [...current, member.id]);
                                                    } else {
                                                        setSelectedInviteMemberIds((current) =>
                                                            current.filter((id) => id !== member.id)
                                                        );
                                                    }
                                                }}
                                                sx={{
                                                    color: '#5f6881',
                                                    '&.Mui-checked': { color: '#5865F2' },
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography variant="body2" sx={{ color: '#d8deee' }}>
                                                {member.name}
                                            </Typography>
                                        }
                                    />
                                );
                            })}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => {
                            setAddMembersOpen(false);
                            setSelectedInviteMemberIds([]);
                        }}
                        sx={{ color: '#7782a1', textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleAddMembersToChannel()}
                        disabled={selectedInviteMemberIds.length === 0}
                        variant="contained"
                        sx={{
                            bgcolor: '#5865F2',
                            color: '#fff',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#4c59de' },
                            '&.Mui-disabled': { bgcolor: '#2d3550', color: '#647092' },
                        }}
                    >
                        Add Members
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
