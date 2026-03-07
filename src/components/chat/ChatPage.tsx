import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useSpacetimeDBQuery, useReducer } from 'spacetimedb/tanstack';
import { tables, reducers } from '../../module_bindings';
import { appRadii } from '../../theme/radii';
import type {
    ChatCallParticipant as DbChatCallParticipant,
    ChatCallSession as DbChatCallSession,
    ChatChannel as DbChatChannel,
    ChatChannelMember as DbChatChannelMember,
    ChatMessage as DbChatMessage,
    ChatReaction as DbChatReaction,
    ChatReadState as DbChatReadState,
    ChatScheduledMeeting as DbChatScheduledMeeting,
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
import { DyteCallInline } from '../calls/DyteCallInline';
import { chatColors } from '../../theme/chatColors';
import {
    clearActiveCallSnapshot,
    getActiveCallSnapshot,
    patchActiveCallSnapshot,
    setActiveCallSnapshot,
} from '../../lib/activeCall';
import { createDyteMeetingAccess, joinDyteMeetingAccess } from '../../server/dyte';

const NONE_U64 = 18446744073709551615n;

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

function formatMessageTime(timestamp: bigint): string {
    return new Date(Number(timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseBigIntOrNull(value: string | null): bigint | null {
    if (!value) return null;
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}

export function ChatPage() {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const navigate = useNavigate();

    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allMessages] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_message : 'skip');
    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allMemberships] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allOrganizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [allReactions] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_reaction : 'skip');
    const [allReadStates] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_read_state : 'skip');
    const [allTypingRows] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_typing : 'skip');
    const [allPresenceRows] = useSpacetimeDBQuery(isAuthenticated ? tables.user_presence : 'skip');
    const [allCallSessions] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_call_session : 'skip');
    const [allCallParticipants] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_call_participant : 'skip');
    const [allScheduledMeetings] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_scheduled_meeting : 'skip');

    const createChannel = useReducer(reducers.createChannel);
    const sendMessageReducer = useReducer(reducers.sendMessage);
    const addChannelMemberReducer = useReducer(reducers.addChannelMember);
    const heartbeatReducer = useReducer(reducers.heartbeat);
    const setTypingReducer = useReducer(reducers.setTyping);
    const markChannelReadReducer = useReducer(reducers.markChannelRead);
    const toggleReactionReducer = useReducer(reducers.toggleReaction);
    const editMessageReducer = useReducer(reducers.editMessage);
    const startChannelCallReducer = useReducer(reducers.startChannelCall);
    const joinChannelCallReducer = useReducer(reducers.joinChannelCall);
    const leaveChannelCallReducer = useReducer(reducers.leaveChannelCall);
    const endChannelCallReducer = useReducer(reducers.endChannelCall);
    const joinScheduledMeetingReducer = useReducer(reducers.joinScheduledMeeting);

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
    const [threadComposerFocusSignal, setThreadComposerFocusSignal] = useState(0);
    const [dyteCallOpen, setDyteCallOpen] = useState(false);
    const [dyteCallLoading, setDyteCallLoading] = useState(false);
    const [dyteAuthToken, setDyteAuthToken] = useState<string | null>(null);
    const [dyteCallTitle, setDyteCallTitle] = useState('');
    const [dyteCallSessionId, setDyteCallSessionId] = useState<bigint | null>(null);
    const [dyteCallChannelId, setDyteCallChannelId] = useState<bigint | null>(null);
    const [dyteCallMeetingId, setDyteCallMeetingId] = useState<string | null>(null);
    const [pendingLeaveMeetingId, setPendingLeaveMeetingId] = useState<string | null>(null);
    const [confirmEndCallOpen, setConfirmEndCallOpen] = useState(false);
    const [endingCall, setEndingCall] = useState(false);
    const [joiningScheduledMeetingId, setJoiningScheduledMeetingId] = useState<bigint | null>(null);

    const lastMarkedReadRef = useRef<string>('');
    const typingSyncRef = useRef<string>('');

    const currentMembership = memberships[0];
    const orgId = currentMembership?.orgId ?? null;

    const channels = (allChannels || []) as DbChatChannel[];
    const channelMembers = (allChannelMembers || []) as DbChatChannelMember[];
    const messages = (allMessages || []) as DbChatMessage[];
    const users = (allUsers || []) as DbUser[];
    const membershipsForAllUsers = (allMemberships || []) as DbOrganizationMember[];
    const organizations = allOrganizations || [];
    const reactions = (allReactions || []) as DbChatReaction[];
    const readStates = (allReadStates || []) as DbChatReadState[];
    const typingRows = (allTypingRows || []) as DbChatTyping[];
    const presenceRows = (allPresenceRows || []) as DbUserPresence[];
    const callSessions = (allCallSessions || []) as DbChatCallSession[];
    const callParticipants = (allCallParticipants || []) as DbChatCallParticipant[];
    const scheduledMeetings = (allScheduledMeetings || []) as DbChatScheduledMeeting[];

    const currentUser = useMemo(() => {
        if (!currentMembership) return null;
        return users.find((u) => u.id === currentMembership.userId) || null;
    }, [currentMembership, users]);

    const orgName = useMemo(() => {
        if (orgId == null) return 'Workspace';
        const org = organizations.find((candidate) => candidate.id === orgId);
        return org?.name || 'Workspace';
    }, [orgId, organizations]);

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

    useEffect(() => {
        const persisted = getActiveCallSnapshot();
        if (!persisted.open || !persisted.authToken) return;

        const persistedChannelId = parseBigIntOrNull(persisted.channelId);
        const persistedSessionId = parseBigIntOrNull(persisted.callSessionId);
        if (persistedChannelId != null) {
            setSelectedChannelId(persistedChannelId);
        }
        setDyteAuthToken(persisted.authToken);
        setDyteCallTitle(persisted.title || 'Video Meeting');
        setDyteCallChannelId(persistedChannelId);
        setDyteCallSessionId(persistedSessionId);
        setDyteCallMeetingId(persisted.meetingId || null);
        setPendingLeaveMeetingId(null);
        setDyteCallOpen(true);
    }, []);

    const selectedChannel = useMemo(() => {
        if (selectedChannelId == null) return null;
        return myChannels.find((channel) => channel.id === selectedChannelId) || null;
    }, [myChannels, selectedChannelId]);

    const activeCallByChannel = useMemo(() => {
        const map = new Map<string, DbChatCallSession>();
        for (const session of callSessions) {
            if (session.status !== 'active' || session.endedAt !== NONE_U64) continue;
            const key = String(session.channelId);
            const existing = map.get(key);
            if (!existing || Number(session.updatedAt) > Number(existing.updatedAt)) {
                map.set(key, session);
            }
        }
        return map;
    }, [callSessions]);

    const callParticipantsBySession = useMemo(() => {
        const map = new Map<string, DbChatCallParticipant[]>();
        for (const participant of callParticipants) {
            if (participant.leftAt !== NONE_U64) continue;
            const key = String(participant.callSessionId);
            const existing = map.get(key);
            if (existing) {
                existing.push(participant);
            } else {
                map.set(key, [participant]);
            }
        }
        return map;
    }, [callParticipants]);

    const selectedChannelActiveCall = useMemo(() => {
        if (selectedChannelId == null) return null;
        return activeCallByChannel.get(String(selectedChannelId)) || null;
    }, [activeCallByChannel, selectedChannelId]);

    const selectedChannelActiveCallParticipants = useMemo(() => {
        if (!selectedChannelActiveCall) return [];
        return callParticipantsBySession.get(String(selectedChannelActiveCall.id)) || [];
    }, [callParticipantsBySession, selectedChannelActiveCall]);

    const selectedChannelActiveCallParticipantNames = useMemo(() => {
        return selectedChannelActiveCallParticipants
            .map((participant) => userById.get(String(participant.userId))?.name || null)
            .filter((name): name is string => !!name)
            .slice(0, 4);
    }, [selectedChannelActiveCallParticipants, userById]);

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

    const mentionableUsers = useMemo(
        () => selectedChannelMembers.map((member) => ({ id: member.id, name: member.name })),
        [selectedChannelMembers]
    );

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
            if (msg.parentMessageId === 0n || msg.parentMessageId === NONE_U64) continue;
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
        () => filteredChannelMessages.filter((msg) => msg.parentMessageId === 0n || msg.parentMessageId === NONE_U64),
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

    const activeThreadRootSender = useMemo(() => {
        if (!activeThreadRootMessage) return null;
        return userById.get(String(activeThreadRootMessage.senderId)) || null;
    }, [activeThreadRootMessage, userById]);

    const activeThreadRootIsOwn = !!(
        activeThreadRootMessage &&
        currentUser &&
        activeThreadRootMessage.senderId === currentUser.id
    );

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

    useEffect(() => {
        if (!dyteCallOpen || dyteCallSessionId != null || !dyteCallMeetingId) return;
        const matched = callSessions.find(
            (session) =>
                session.dyteMeetingId === dyteCallMeetingId &&
                session.status === 'active' &&
                session.endedAt === NONE_U64
        );
        if (matched) {
            setDyteCallSessionId(matched.id);
            patchActiveCallSnapshot({ callSessionId: String(matched.id) });
        }
    }, [callSessions, dyteCallMeetingId, dyteCallOpen, dyteCallSessionId]);

    useEffect(() => {
        if (!dyteCallOpen || dyteCallSessionId == null) return;
        const active = callSessions.find((session) => session.id === dyteCallSessionId) || null;
        if (!active || active.status !== 'active' || active.endedAt !== NONE_U64) {
            setDyteCallOpen(false);
            setDyteAuthToken(null);
            setDyteCallTitle('');
            setDyteCallSessionId(null);
            setDyteCallChannelId(null);
            setDyteCallMeetingId(null);
            setPendingLeaveMeetingId(null);
            clearActiveCallSnapshot();
            toast.message('Call ended');
        }
    }, [callSessions, dyteCallOpen, dyteCallSessionId]);

    useEffect(() => {
        if (!pendingLeaveMeetingId) return;
        const pendingSession = callSessions.find(
            (session) =>
                session.dyteMeetingId === pendingLeaveMeetingId &&
                session.status === 'active' &&
                session.endedAt === NONE_U64
        );
        if (!pendingSession) return;

        setPendingLeaveMeetingId(null);
        void leaveChannelCallReducer({ callSessionId: pendingSession.id }).catch(() => {
            // Best-effort cleanup for leave race cases.
        });
    }, [callSessions, leaveChannelCallReducer, pendingLeaveMeetingId]);

    useEffect(() => {
        if (!dyteCallOpen || !dyteAuthToken) return;
        patchActiveCallSnapshot({
            open: true,
            authToken: dyteAuthToken,
            title: dyteCallTitle,
            channelId: dyteCallChannelId == null ? null : String(dyteCallChannelId),
            meetingId: dyteCallMeetingId,
            callSessionId: dyteCallSessionId == null ? null : String(dyteCallSessionId),
        });
    }, [dyteAuthToken, dyteCallChannelId, dyteCallMeetingId, dyteCallOpen, dyteCallSessionId, dyteCallTitle]);

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

    const openThreadFromMessage = (messageId: bigint) => {
        setActiveThreadParentId(messageId);
        setThreadComposerFocusSignal((current) => current + 1);
    };

    const focusThreadComposer = () => {
        setThreadComposerFocusSignal((current) => current + 1);
    };

    const openDyteCallDialog = (args: {
        authToken: string;
        title: string;
        channelId: bigint;
        meetingId: string;
        callSessionId: bigint | null;
    }) => {
        setSelectedChannelId(args.channelId);
        setActiveThreadParentId(null);
        setDyteAuthToken(args.authToken);
        setDyteCallTitle(args.title);
        setDyteCallChannelId(args.channelId);
        setDyteCallSessionId(args.callSessionId);
        setDyteCallMeetingId(args.meetingId);
        setPendingLeaveMeetingId(null);
        setDyteCallOpen(true);
        setActiveCallSnapshot({
            open: true,
            authToken: args.authToken,
            title: args.title,
            channelId: String(args.channelId),
            meetingId: args.meetingId,
            callSessionId: args.callSessionId == null ? null : String(args.callSessionId),
        });
    };

    const handleJoinDyteCall = async (callSession: DbChatCallSession) => {
        if (currentUser == null || dyteCallLoading) return;

        setDyteCallLoading(true);
        try {
            const joinResult = await joinDyteMeetingAccess({
                data: {
                    meetingId: callSession.dyteMeetingId,
                    channelId: String(callSession.channelId),
                    participantName: currentUser.name || currentUser.email || 'Participant',
                } as any,
            });

            if (!joinResult.success || !joinResult.authToken) {
                toast.error(joinResult.error || 'Could not join call');
                return;
            }

            await joinChannelCallReducer({ callSessionId: callSession.id });

            openDyteCallDialog({
                authToken: joinResult.authToken,
                title: callSession.title,
                channelId: callSession.channelId,
                meetingId: callSession.dyteMeetingId,
                callSessionId: callSession.id,
            });
            toast.success('You joined the meeting.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to join the meeting');
        } finally {
            setDyteCallLoading(false);
        }
    };

    const handleJoinScheduledMeetingFromSidebar = async (meetingId: bigint) => {
        if (currentUser == null || dyteCallLoading) return;
        const meeting = scheduledMeetings.find((row) => row.id === meetingId) || null;
        if (!meeting) {
            toast.error('Meeting not found');
            return;
        }

        if (meeting.status === 'cancelled') {
            toast.message('This meeting was cancelled.');
            return;
        }
        if (meeting.status === 'ended') {
            toast.message('This meeting has ended.');
            return;
        }

        const now = Date.now();
        const joinOpenAt = Number(meeting.scheduledAt) - 10 * 60_000;
        if (meeting.status !== 'started' && now < joinOpenAt) {
            const mins = Math.max(1, Math.ceil((joinOpenAt - now) / 60_000));
            toast.message(`Join opens in ${mins}m`);
            return;
        }

        const fallbackUiChannelId =
            meeting.channelId !== NONE_U64
                ? meeting.channelId
                : (selectedChannelId ?? myChannels[0]?.id ?? 0n);
        if (fallbackUiChannelId === 0n) {
            toast.message('Open this public meeting from Meeting Manager.');
            return;
        }

        setJoiningScheduledMeetingId(meeting.id);
        setDyteCallLoading(true);
        try {
            await joinScheduledMeetingReducer({ meetingId: meeting.id });

            const joinResult = await joinDyteMeetingAccess({
                data: {
                    meetingId: meeting.dyteMeetingId,
                    channelId:
                        meeting.channelId === NONE_U64
                            ? `public-${String(meeting.orgId)}`
                            : String(meeting.channelId),
                    participantName: currentUser.name || currentUser.email || 'Participant',
                } as any,
            });

            if (!joinResult.success || !joinResult.authToken) {
                toast.error(joinResult.error || 'Could not join meeting');
                return;
            }

            const activeSession =
                callSessions.find(
                    (session) =>
                        session.channelId === meeting.channelId &&
                        session.dyteMeetingId === meeting.dyteMeetingId &&
                        session.status === 'active' &&
                        session.endedAt === NONE_U64
                ) || null;

            const callSessionId =
                activeSession?.id ||
                (meeting.startedCallSessionId !== NONE_U64 ? meeting.startedCallSessionId : null);

            openDyteCallDialog({
                authToken: joinResult.authToken,
                title: meeting.title,
                channelId: fallbackUiChannelId,
                meetingId: meeting.dyteMeetingId,
                callSessionId,
            });
            toast.success('Meeting opened');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to join meeting');
        } finally {
            setDyteCallLoading(false);
            setJoiningScheduledMeetingId(null);
        }
    };

    const handleStartDyteCall = async () => {
        if (selectedChannel == null || currentUser == null || dyteCallLoading) return;

        if (selectedChannelActiveCall) {
            await handleJoinDyteCall(selectedChannelActiveCall);
            return;
        }

        setDyteCallLoading(true);
        try {
            const createResult = await createDyteMeetingAccess({
                data: {
                    channelId: String(selectedChannel.id),
                    channelName: selectedChannel.name,
                    participantName: currentUser.name || currentUser.email || 'Participant',
                    orgName,
                } as any,
            });

            if (!createResult.success || !createResult.authToken || !createResult.meetingId) {
                toast.error(createResult.error || 'Could not start video call');
                return;
            }

            await startChannelCallReducer({
                channelId: selectedChannel.id,
                dyteMeetingId: createResult.meetingId,
                title: createResult.meetingTitle || `${selectedChannel.name} call`,
            });

            openDyteCallDialog({
                authToken: createResult.authToken,
                title: createResult.meetingTitle || `${selectedChannel.name} call`,
                channelId: selectedChannel.id,
                meetingId: createResult.meetingId,
                callSessionId: null,
            });
            toast.success('Meeting started.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to start the meeting');
        } finally {
            setDyteCallLoading(false);
        }
    };

    const openEndCallConfirmation = () => {
        if (!selectedChannelActiveCall) return;
        setConfirmEndCallOpen(true);
    };

    const handleConfirmEndSelectedChannelCall = async () => {
        if (!selectedChannelActiveCall) return;
        setEndingCall(true);
        try {
            await endChannelCallReducer({ callSessionId: selectedChannelActiveCall.id });
            toast.success('Meeting ended for all participants.');
            setConfirmEndCallOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to end the meeting');
        } finally {
            setEndingCall(false);
        }
    };

    const handleDyteCallClose = () => {
        const fallbackByMeeting =
            dyteCallMeetingId == null
                ? null
                : callSessions.find(
                    (session) =>
                        session.dyteMeetingId === dyteCallMeetingId &&
                        session.status === 'active' &&
                        session.endedAt === NONE_U64
                ) || null;

        const fallbackSession =
            dyteCallSessionId ??
            (dyteCallChannelId != null
                ? activeCallByChannel.get(String(dyteCallChannelId))?.id ?? null
                : null) ??
            fallbackByMeeting?.id ??
            null;

        if (fallbackSession != null) {
            void leaveChannelCallReducer({ callSessionId: fallbackSession }).catch(() => {
                // Best-effort leave update.
            });
        } else if (dyteCallMeetingId) {
            setPendingLeaveMeetingId(dyteCallMeetingId);
        }

        setDyteCallOpen(false);
        setDyteAuthToken(null);
        setDyteCallTitle('');
        setDyteCallSessionId(null);
        setDyteCallChannelId(null);
        setDyteCallMeetingId(null);
        if (fallbackSession != null) {
            setPendingLeaveMeetingId(null);
        }
        clearActiveCallSnapshot();
    };

    const activeCallSummaryByChannel = useMemo(() => {
        const summary: Record<string, { title: string; participantCount: number }> = {};
        for (const [channelKey, session] of activeCallByChannel.entries()) {
            const count = callParticipantsBySession.get(String(session.id))?.length || 0;
            summary[channelKey] = {
                title: session.title,
                participantCount: count,
            };
        }
        return summary;
    }, [activeCallByChannel, callParticipantsBySession]);

    const upcomingMeetingsForSidebar = useMemo(() => {
        if (orgId == null) return [];
        const myChannelIds = new Set(myChannels.map((channel) => String(channel.id)));

        return scheduledMeetings
            .filter(
                (meeting) =>
                    meeting.orgId === orgId &&
                    (meeting.visibility === 'public' || myChannelIds.has(String(meeting.channelId))) &&
                    (meeting.status === 'scheduled' || meeting.status === 'started')
            )
            .sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt))
            .map((meeting) => ({
                id: meeting.id,
                channel_id: meeting.channelId,
                title: meeting.title,
                scheduled_at: meeting.scheduledAt,
                status: meeting.status,
                visibility: meeting.visibility,
            }));
    }, [myChannels, orgId, scheduledMeetings]);

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
        parent_message_id: msg.parentMessageId === NONE_U64 ? 0n : msg.parentMessageId,
        content: msg.content,
        created_at: msg.createdAt,
        edited_at: msg.editedAt === NONE_U64 ? 0n : msg.editedAt,
    }));

    const threadMessageRows = threadReplies.map((msg) => ({
        id: msg.id,
        channel_id: msg.channelId,
        sender_id: msg.senderId,
        parent_message_id: msg.parentMessageId === NONE_U64 ? 0n : msg.parentMessageId,
        content: msg.content,
        created_at: msg.createdAt,
        edited_at: msg.editedAt === NONE_U64 ? 0n : msg.editedAt,
    }));

    const channelHeaderSubtitle = selectedChannel
        ? [
            selectedChannel.type === 'dm' ? 'Direct message' : `${selectedChannelMembers.length} members`,
            selectedChannelActiveCall
                ? `${selectedChannelActiveCallParticipants.length} in call`
                : null,
        ].filter((part): part is string => !!part).join(' • ')
        : '';
    const isInlineCallActive = dyteCallOpen && dyteAuthToken != null;

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

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate({ to: '/login' });
        }
    }, [isAuthenticated, isLoading, navigate]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && !isCheckingMembership && !hasOrganization) {
            navigate({ to: '/onboarding' });
        }
    }, [hasOrganization, isAuthenticated, isCheckingMembership, isLoading, navigate]);

    if (isLoading || (isAuthenticated && isCheckingMembership)) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#000000' }}>
                <CircularProgress size={24} sx={{ color: '#ffffff' }} />
            </Box>
        );
    }

    if (!isAuthenticated || !hasOrganization) return null;

    return (
        <DashboardLayout
            onLogout={logout}
            orgName={orgName}
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
                    activeCallByChannel={activeCallSummaryByChannel}
                    scheduledMeetings={upcomingMeetingsForSidebar}
                    joiningMeetingId={joiningScheduledMeetingId}
                    onJoinMeeting={(meetingId) => {
                        void handleJoinScheduledMeetingFromSidebar(meetingId);
                    }}
                    onOpenMeetingManager={() => {
                        void navigate({ to: '/meetings' });
                    }}
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
                                        <TagRoundedIcon sx={{ fontSize: 18, color: '#858585' }} />
                                    ) : (
                                        <ChatOutlinedIcon sx={{ fontSize: 18, color: '#858585' }} />
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
                                        <Typography variant="caption" sx={{ color: '#858585', fontSize: '0.68rem' }}>
                                            {channelHeaderSubtitle}
                                        </Typography>
                                    </Box>
                                </Stack>

                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 220,
                                            maxWidth: '40vw',
                                            bgcolor: '#111111',
                                            border: '1px solid #333333',
                                            borderRadius: appRadii.control,
                                            px: 1.1,
                                            py: 0.55,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.8,
                                            '&:focus-within': { borderColor: '#ffffff' },
                                        }}
                                    >
                                        <SearchRoundedIcon sx={{ color: '#666666', fontSize: 16 }} />
                                        <InputBase
                                            placeholder="Search messages"
                                            value={messageSearch}
                                            onChange={(event) => setMessageSearch(event.target.value)}
                                            sx={{ color: '#fff', fontSize: '0.8rem', width: '100%' }}
                                        />
                                    </Box>

                                    <Tooltip title={selectedChannelActiveCall ? 'Join active call' : 'Start video call'}>
                                        <span>
                                            <IconButton
                                                onClick={() => {
                                                    void handleStartDyteCall();
                                                }}
                                                disabled={dyteCallLoading}
                                                sx={{
                                                    color: selectedChannelActiveCall ? '#5bd589' : '#858585',
                                                    borderRadius: appRadii.control,
                                                    bgcolor: selectedChannelActiveCall ? 'rgba(91,213,137,0.13)' : 'transparent',
                                                    '&:hover': {
                                                        bgcolor: selectedChannelActiveCall ? 'rgba(91,213,137,0.2)' : 'rgba(255,255,255,0.12)',
                                                        color: '#ffffff',
                                                    },
                                                    '&.Mui-disabled': { color: '#575757' },
                                                }}
                                            >
                                                {dyteCallLoading ? (
                                                    <CircularProgress size={16} sx={{ color: '#ffffff' }} />
                                                ) : (
                                                    <VideocamRoundedIcon sx={{ fontSize: 20 }} />
                                                )}
                                            </IconButton>
                                        </span>
                                    </Tooltip>

                                    <Tooltip title="Threads">
                                        <IconButton
                                            onClick={() => {
                                                if (activeThreadParentId != null) {
                                                    setActiveThreadParentId(null);
                                                } else {
                                                    const firstRoot = mainChannelMessages[0];
                                                    if (firstRoot) openThreadFromMessage(firstRoot.id);
                                                }
                                            }}
                                            sx={{
                                                color: activeThreadParentId ? '#ffffff' : '#858585',
                                                bgcolor: activeThreadParentId ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                borderRadius: appRadii.control,
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#ffffff' },
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
                                                borderColor: '#333333',
                                                color: '#858585',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderRadius: appRadii.control,
                                                '&:hover': { borderColor: '#555555', color: '#ffffff' },
                                            }}
                                        >
                                            Add People
                                        </Button>
                                    )}

                                    <Tooltip title={showMembersPanel ? 'Hide members' : 'Show members'}>
                                        <IconButton
                                            onClick={() => setShowMembersPanel((current) => !current)}
                                            sx={{
                                                color: showMembersPanel ? '#ffffff' : '#858585',
                                                bgcolor: showMembersPanel ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                borderRadius: appRadii.control,
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#ffffff' },
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
                                        borderBottom: '1px solid #1a1a1a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Typography variant="caption" sx={{ color: '#858585', fontSize: '0.72rem' }}>
                                        {filteredChannelMessages.length} result{filteredChannelMessages.length === 1 ? '' : 's'}
                                        {' '}for "{messageSearch.trim()}"
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={() => setMessageSearch('')}
                                        sx={{ color: '#858585', textTransform: 'none', minWidth: 0 }}
                                    >
                                        Clear
                                    </Button>
                                </Box>
                            )}

                            {selectedChannelActiveCall && !isInlineCallActive && (
                                <Box
                                    sx={{
                                        px: 3,
                                        py: 0.75,
                                        borderBottom: '1px solid #1a1a1a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1.5,
                                        bgcolor: 'rgba(8,33,20,0.45)',
                                        backdropFilter: 'blur(6px)',
                                    }}
                                >
                                    <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                        <Stack direction="row" spacing={0.8} alignItems="center">
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: appRadii.full,
                                                    bgcolor: '#52d07f',
                                                    boxShadow: '0 0 0 4px rgba(82,208,127,0.18)',
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    color: '#e4ffe8',
                                                    fontSize: '0.77rem',
                                                    fontWeight: 700,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                Live call: {selectedChannelActiveCall.title}
                                            </Typography>
                                        </Stack>
                                        <Typography sx={{ color: '#91c9a0', fontSize: '0.67rem' }}>
                                            {selectedChannelActiveCallParticipants.length} participant{selectedChannelActiveCallParticipants.length === 1 ? '' : 's'}
                                            {selectedChannelActiveCallParticipantNames.length > 0
                                                ? ` • ${selectedChannelActiveCallParticipantNames.join(', ')}`
                                                : ''}
                                        </Typography>
                                    </Stack>

                                    <Stack direction="row" spacing={0.8}>
                                        <Button
                                            size="small"
                                            onClick={() => void handleJoinDyteCall(selectedChannelActiveCall)}
                                            disabled={dyteCallLoading}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                fontSize: '0.7rem',
                                                minWidth: 0,
                                                px: 1.2,
                                                py: 0.35,
                                                borderRadius: appRadii.control,
                                                color: '#0c2a16',
                                                bgcolor: '#8bf2ae',
                                                '&:hover': { bgcolor: '#74e698' },
                                                '&.Mui-disabled': { bgcolor: '#3d4d43', color: '#93a096' },
                                            }}
                                        >
                                            Join
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={openEndCallConfirmation}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                fontSize: '0.7rem',
                                                minWidth: 0,
                                                px: 1.1,
                                                py: 0.35,
                                                borderRadius: appRadii.control,
                                                color: '#ffb6b6',
                                                border: '1px solid rgba(255,120,120,0.35)',
                                                '&:hover': { bgcolor: 'rgba(255,120,120,0.12)' },
                                            }}
                                        >
                                            End for all
                                        </Button>
                                    </Stack>
                                </Box>
                            )}

                            <Box sx={{ flexGrow: 1, minHeight: 0, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
                                {isInlineCallActive ? (
                                    <Box sx={{ flexGrow: 1, minHeight: 0, minWidth: 0, p: 1.25, bgcolor: '#020202', overflow: 'hidden' }}>
                                        <Box
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                minWidth: 0,
                                                minHeight: 0,
                                                borderRadius: appRadii.panel,
                                                overflow: 'hidden',
                                                border: '1px solid #1a1a1a',
                                                bgcolor: '#000000',
                                            }}
                                        >
                                            <DyteCallInline
                                                authToken={dyteAuthToken}
                                                title={dyteCallTitle || `${selectedChannel.name} call`}
                                                onClose={handleDyteCallClose}
                                            />
                                        </Box>
                                    </Box>
                                ) : (
                                    <MessageList
                                        messages={messageListMessages}
                                        users={users}
                                        currentUserId={currentUser?.id || null}
                                        currentUserName={currentUser?.name || ''}
                                        searchTerm={messageSearch}
                                        reactionsByMessage={reactionsByMessage}
                                        replyCountByMessage={replyCountByMessage}
                                        onToggleReaction={handleToggleReaction}
                                        onOpenThread={openThreadFromMessage}
                                        onReply={(message) => openThreadFromMessage(message.id)}
                                        onEditMessage={handleEditMessage}
                                    />
                                )}
                            </Box>

                            {!isInlineCallActive && (
                                <>
                                    <Typography
                                        variant="caption"
                                        sx={{ px: 3, py: 0.4, color: '#858585', fontSize: '0.72rem', minHeight: 18 }}
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
                                        mentionUsers={mentionableUsers}
                                        onTypingChange={setComposerTyping}
                                        draftScope="main"
                                    />
                                </>
                            )}
                        </Box>

                        {activeThreadRootMessage ? (
                            <Box
                                sx={{
                                    width: { xs: '100%', lg: 380, xl: 460 },
                                    borderLeft: '1px solid #1a1a1a',
                                    bgcolor: '#050505',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 1.2,
                                        borderBottom: '1px solid #1a1a1a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ color: '#ffffff', fontSize: '0.86rem', fontWeight: 700 }}>
                                            Thread
                                        </Typography>
                                        <Stack direction="row" spacing={0.7} alignItems="center">
                                            <Typography sx={{ color: '#858585', fontSize: '0.67rem' }}>
                                                #{selectedChannel.name}
                                            </Typography>
                                            <Typography sx={{ color: '#555', fontSize: '0.67rem' }}>•</Typography>
                                            <Typography sx={{ color: '#858585', fontSize: '0.67rem' }}>
                                                {threadReplies.length} repl{threadReplies.length === 1 ? 'y' : 'ies'}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                    <IconButton
                                        onClick={() => setActiveThreadParentId(null)}
                                        size="small"
                                        sx={{ color: '#858585' }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Box>

                                <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid #1a1a1a' }}>
                                    <Stack direction="row" spacing={0.65} alignItems="baseline" sx={{ mb: 0.45 }}>
                                        <Typography
                                            sx={{
                                                color: '#ffffff',
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {activeThreadRootSender?.name || 'Unknown'}
                                        </Typography>
                                        {activeThreadRootIsOwn && (
                                            <Typography sx={{ color: '#74a7ff', fontSize: '0.67rem', fontWeight: 700 }}>
                                                You
                                            </Typography>
                                        )}
                                        <Typography sx={{ color: '#666', fontSize: '0.66rem' }}>
                                            {formatMessageTime(activeThreadRootMessage.createdAt)}
                                        </Typography>
                                    </Stack>
                                    <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {activeThreadRootMessage.content}
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={focusThreadComposer}
                                        sx={{
                                            mt: 0.65,
                                            minWidth: 0,
                                            textTransform: 'none',
                                            color: '#9ec0ff',
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            px: 0.9,
                                            py: 0.15,
                                            borderRadius: appRadii.control,
                                            bgcolor: 'rgba(116,167,255,0.14)',
                                            border: '1px solid rgba(116,167,255,0.35)',
                                            '&:hover': {
                                                bgcolor: 'rgba(116,167,255,0.24)',
                                                borderColor: 'rgba(116,167,255,0.5)',
                                            },
                                        }}
                                    >
                                        Reply in thread
                                    </Button>
                                </Box>

                                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
                                    <MessageList
                                        messages={threadMessageRows}
                                        users={users}
                                        currentUserId={currentUser?.id || null}
                                        currentUserName={currentUser?.name || ''}
                                        threadMode
                                        reactionsByMessage={reactionsByMessage}
                                        onToggleReaction={handleToggleReaction}
                                        onReply={() => focusThreadComposer()}
                                        onEditMessage={handleEditMessage}
                                    />
                                </Box>

                                <MessageInput
                                    onSend={(content) => handleSendMessage(content, activeThreadRootMessage.id)}
                                    channelId={selectedChannel.id}
                                    channelName={selectedChannel.name}
                                    mentionUsers={mentionableUsers}
                                    contextHint={`Replying in thread (${threadReplies.length} repl${threadReplies.length === 1 ? 'y' : 'ies'})`}
                                    draftScope={`thread-${String(activeThreadRootMessage.id)}`}
                                    onTypingChange={setComposerTyping}
                                    focusSignal={threadComposerFocusSignal}
                                />
                            </Box>
                        ) : isInlineCallActive ? (
                            <Box
                                sx={{
                                    width: { xs: '100%', lg: 380, xl: 420 },
                                    borderLeft: '1px solid #1a1a1a',
                                    bgcolor: '#050505',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 1.2,
                                        borderBottom: '1px solid #1a1a1a',
                                    }}
                                >
                                    <Typography sx={{ color: '#ffffff', fontSize: '0.86rem', fontWeight: 700 }}>
                                        Conversation
                                    </Typography>
                                    <Typography sx={{ color: '#858585', fontSize: '0.67rem' }}>
                                        Use Reply on any message to open a thread.
                                    </Typography>
                                </Box>

                                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
                                    <MessageList
                                        messages={messageListMessages}
                                        users={users}
                                        currentUserId={currentUser?.id || null}
                                        currentUserName={currentUser?.name || ''}
                                        searchTerm={messageSearch}
                                        reactionsByMessage={reactionsByMessage}
                                        replyCountByMessage={replyCountByMessage}
                                        onToggleReaction={handleToggleReaction}
                                        onOpenThread={openThreadFromMessage}
                                        onReply={(message) => openThreadFromMessage(message.id)}
                                        onEditMessage={handleEditMessage}
                                    />
                                </Box>

                                <Typography
                                    variant="caption"
                                    sx={{ px: 2, py: 0.4, color: '#858585', fontSize: '0.72rem', minHeight: 18 }}
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
                                    mentionUsers={mentionableUsers}
                                    onTypingChange={setComposerTyping}
                                    draftScope="call-side"
                                />
                            </Box>
                        ) : showMembersPanel ? (
                            <Box
                                sx={{
                                    width: 252,
                                    borderLeft: '1px solid #1a1a1a',
                                    bgcolor: '#050505',
                                    display: { xs: 'none', lg: 'flex' },
                                    flexDirection: 'column',
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.6 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: '#858585',
                                            fontWeight: 700,
                                            fontSize: '0.68rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                        }}
                                    >
                                        Members - {selectedChannelMembers.length}
                                    </Typography>
                                </Box>
                                <Divider sx={{ borderColor: '#1a1a1a' }} />
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
                                                    borderRadius: appRadii.card,
                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                                                }}
                                            >
                                                <Box sx={{ position: 'relative' }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 30,
                                                            height: 30,
                                                            bgcolor: '#1a1a1a',
                                                            color: '#ffffff',
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
                                                                borderRadius: appRadii.full,
                                                                bgcolor: '#38c872',
                                                                border: '2px solid #050505',
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: '#ffffff',
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
                                                        sx={{ color: '#666666', fontSize: '0.66rem' }}
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
                            backgroundColor: chatColors.pageBg,
                        }}
                    >
                        <Box
                            sx={{
                                width: 84,
                                height: 84,
                                borderRadius: appRadii.panel,
                                bgcolor: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.16)',
                                display: 'grid',
                                placeItems: 'center',
                            }}
                        >
                            <ChatOutlinedIcon sx={{ fontSize: 38, color: '#ffffff' }} />
                        </Box>
                        <Stack spacing={1} alignItems="center">
                            <Typography
                                variant="h5"
                                sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', textAlign: 'center' }}
                            >
                                Organization Chat
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Chip
                                    size="small"
                                    label={`${myChannels.length} channels`}
                                    sx={{ bgcolor: '#111111', color: '#858585', fontWeight: 600 }}
                                />
                                <Chip
                                    size="small"
                                    label={`${dmUnreadTotal} DM unread`}
                                    sx={{ bgcolor: '#111111', color: '#858585', fontWeight: 600 }}
                                />
                                <Chip
                                    size="small"
                                    label={`${groupUnreadTotal} group unread`}
                                    sx={{ bgcolor: '#111111', color: '#858585', fontWeight: 600 }}
                                />
                            </Stack>
                            <Typography
                                variant="caption"
                                sx={{ color: '#858585', textAlign: 'center', maxWidth: 360, mt: 0.5, fontSize: '0.75rem' }}
                            >
                                Start a DM or group channel. Presence, threads, and reactions keep chats organized.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                variant="contained"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setNewChatOpen(true)}
                                sx={{
                                    bgcolor: '#ffffff',
                                    color: '#000000',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: appRadii.control,
                                    px: 3,
                                    '&:hover': { bgcolor: '#e0e0e0' },
                                }}
                            >
                                New DM
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<GroupAddRoundedIcon />}
                                onClick={() => setNewGroupOpen(true)}
                                sx={{
                                    borderColor: '#333333',
                                    color: '#858585',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: appRadii.control,
                                    px: 3,
                                    '&:hover': { borderColor: '#555555', color: '#ffffff' },
                                }}
                            >
                                New Group
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Box>

            <Dialog
                open={confirmEndCallOpen}
                onClose={() => {
                    if (!endingCall) setConfirmEndCallOpen(false);
                }}
                PaperProps={{
                    sx: {
                        bgcolor: '#050505',
                        border: '1px solid #333333',
                        borderRadius: appRadii.panel,
                        minWidth: 380,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                    End meeting for everyone?
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: '#b6bcc7', fontSize: '0.86rem', mt: 0.5 }}>
                        This will immediately disconnect all participants from the current meeting in
                        <Box component="span" sx={{ color: '#ffffff', fontWeight: 700 }}> #{selectedChannel?.name || 'this channel'}</Box>.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setConfirmEndCallOpen(false)}
                        disabled={endingCall}
                        sx={{ color: '#858585', textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleConfirmEndSelectedChannelCall()}
                        disabled={endingCall}
                        variant="contained"
                        sx={{
                            bgcolor: '#e33d4f',
                            color: '#ffffff',
                            textTransform: 'none',
                            fontWeight: 700,
                            '&:hover': { bgcolor: '#cc3445' },
                            '&.Mui-disabled': { bgcolor: '#3d2428', color: '#8f7a7f' },
                        }}
                    >
                        {endingCall ? 'Ending...' : 'End Meeting'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={newChatOpen}
                onClose={() => {
                    setNewChatOpen(false);
                    setNewDmSearch('');
                }}
                PaperProps={{
                    sx: {
                        bgcolor: '#050505',
                        border: '1px solid #333333',
                        borderRadius: appRadii.panel,
                        minWidth: 360,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                    Start a direct message
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            border: '1px solid #333333',
                            borderRadius: appRadii.control,
                            px: 1.25,
                            py: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1.5,
                            mt: 0.5,
                            '&:focus-within': { borderColor: '#ffffff' },
                        }}
                    >
                        <SearchRoundedIcon sx={{ color: '#666666', fontSize: 17 }} />
                        <InputBase
                            placeholder="Search members"
                            value={newDmSearch}
                            onChange={(event) => setNewDmSearch(event.target.value)}
                            fullWidth
                            sx={{ color: '#ffffff', fontSize: '0.85rem' }}
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
                                    borderRadius: appRadii.control,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                                }}
                            >
                                <Avatar
                                    sx={{
                                        width: 33,
                                        height: 33,
                                        bgcolor: '#1a1a1a',
                                        color: '#ffffff',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                    }}
                                >
                                    {member.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {member.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {member.email}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                        {filteredDmCandidates.length === 0 && (
                            <Typography variant="body2" sx={{ color: '#666666', textAlign: 'center', py: 2 }}>
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
                        sx={{ color: '#858585', textTransform: 'none' }}
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
                        bgcolor: '#050505',
                        border: '1px solid #333333',
                        borderRadius: appRadii.panel,
                        minWidth: 380,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
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
                            '& .MuiInputBase-root': { color: '#ffffff', bgcolor: '#111111' },
                            '& .MuiInputLabel-root': { color: '#858585' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333333' },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: '#666666', mb: 1, display: 'block' }}>
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
                                                color: '#666666',
                                                '&.Mui-checked': { color: '#ffffff' },
                                            }}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                            {member.name}
                                        </Typography>
                                    }
                                />
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setNewGroupOpen(false)} sx={{ color: '#858585', textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleCreateGroup()}
                        disabled={!newChannelName.trim() || selectedMemberIds.length === 0}
                        variant="contained"
                        sx={{
                            bgcolor: '#ffffff',
                            color: '#000000',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#e0e0e0' },
                            '&.Mui-disabled': { bgcolor: '#333333', color: '#666666' },
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
                        bgcolor: '#050505',
                        border: '1px solid #333333',
                        borderRadius: appRadii.panel,
                        minWidth: 380,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                    Add members to {selectedChannel?.name || 'channel'}
                </DialogTitle>
                <DialogContent>
                    {availableMembersToAdd.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#666666', py: 2 }}>
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
                                                    color: '#666666',
                                                    '&.Mui-checked': { color: '#ffffff' },
                                                }}
                                            />
                                        }
                                        label={
                                            <Typography variant="body2" sx={{ color: '#ffffff' }}>
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
                        sx={{ color: '#858585', textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleAddMembersToChannel()}
                        disabled={selectedInviteMemberIds.length === 0}
                        variant="contained"
                        sx={{
                            bgcolor: '#ffffff',
                            color: '#000000',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#e0e0e0' },
                            '&.Mui-disabled': { bgcolor: '#333333', color: '#666666' },
                        }}
                    >
                        Add Members
                    </Button>
                </DialogActions>
            </Dialog>

        </DashboardLayout>
    );
}
