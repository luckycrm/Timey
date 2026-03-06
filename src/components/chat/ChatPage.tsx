import { useState, useMemo } from 'react';
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
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { useSpacetimeDBQuery, useReducer } from 'spacetimedb/tanstack';
import { tables, reducers } from '../../module_bindings';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { ChatSidebar } from './ChatSidebar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatPage() {
    const { isAuthenticated } = useAuth();
    const { memberships } = useOrganizationMembership({
        enabled: isAuthenticated,
    });

    const [allChannels] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel : 'skip');
    const [allChannelMembers] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_channel_member : 'skip');
    const [allMessages] = useSpacetimeDBQuery(isAuthenticated ? tables.chat_message : 'skip');
    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allMemberships] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');

    const createChannel = useReducer(reducers.createChannel);
    const sendMessageReducer = useReducer(reducers.sendMessage);

    const [selectedChannelId, setSelectedChannelId] = useState<bigint | null>(null);
    const [newChatOpen, setNewChatOpen] = useState(false);
    const [newGroupOpen, setNewGroupOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<bigint[]>([]);

    // Get org info
    const orgId = memberships?.[0]?.orgId;
    const currentUser = useMemo(() => {
        if (!allUsers || !memberships?.[0]) return null;
        const membership = memberships[0];
        return allUsers.find((u: any) => u.id === membership.userId) || null;
    }, [allUsers, memberships]);

    // Filter channels for this org that the user is a member of
    const myChannels = useMemo(() => {
        if (!allChannels || !allChannelMembers || !currentUser || !orgId) return [];
        const myChannelIds = new Set(
            (allChannelMembers as any[])
                .filter((cm: any) => cm.userId === currentUser.id)
                .map((cm: any) => cm.channelId)
        );
        return (allChannels as any[])
            .filter((ch: any) => ch.orgId === orgId && myChannelIds.has(ch.id))
            .sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt));
    }, [allChannels, allChannelMembers, currentUser, orgId]);

    // Get messages for selected channel
    const channelMessages = useMemo(() => {
        if (!allMessages || selectedChannelId === null) return [];
        return (allMessages as any[]).filter((m: any) => m.channelId === selectedChannelId);
    }, [allMessages, selectedChannelId]);

    // Get the selected channel
    const selectedChannel = useMemo(() => {
        if (selectedChannelId === null) return null;
        return myChannels.find((ch: any) => ch.id === selectedChannelId) || null;
    }, [myChannels, selectedChannelId]);

    // Get org members for creating channels
    const orgMembers = useMemo(() => {
        if (!allMemberships || !allUsers || !orgId || !currentUser) return [];
        const memberUserIds = (allMemberships as any[])
            .filter((m: any) => m.orgId === orgId && m.userId !== currentUser.id)
            .map((m: any) => m.userId);
        return (allUsers as any[]).filter((u: any) => memberUserIds.includes(u.id));
    }, [allMemberships, allUsers, orgId, currentUser]);

    const handleCreateDM = async (targetUserId: bigint) => {
        if (!orgId || !currentUser) return;
        const target = (allUsers as any[])?.find((u: any) => u.id === targetUserId);
        const channelName = target?.name || 'Direct Message';
        try {
            await createChannel({
                orgId: orgId,
                name: channelName,
                type: 'dm',
                memberIds: [targetUserId],
            });
            setNewChatOpen(false);
        } catch (err) {
            console.error('Failed to create DM:', err);
        }
    };

    const handleCreateGroup = async () => {
        if (!orgId || !newChannelName.trim() || selectedMemberIds.length === 0) return;
        try {
            await createChannel({
                orgId: orgId,
                name: newChannelName.trim(),
                type: 'group',
                memberIds: selectedMemberIds,
            });
            setNewGroupOpen(false);
            setNewChannelName('');
            setSelectedMemberIds([]);
        } catch (err) {
            console.error('Failed to create group:', err);
        }
    };

    const handleSendMessage = async (content: string) => {
        if (selectedChannelId === null) return;
        try {
            await sendMessageReducer({ channelId: selectedChannelId, content });
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    };

    // Adapt data for sub-components (they use snake_case interfaces)
    const sidebarChannels = myChannels.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        created_at: ch.createdAt,
    }));

    const sidebarMessages = (allMessages as any[] || []).map((m: any) => ({
        id: m.id,
        channel_id: m.channelId,
        sender_id: m.senderId,
        content: m.content,
        created_at: m.createdAt,
    }));

    const messageListMessages = channelMessages.map((m: any) => ({
        id: m.id,
        channel_id: m.channelId,
        sender_id: m.senderId,
        content: m.content,
        created_at: m.createdAt,
    }));

    return (
        <DashboardLayout
            chatSidebar={
                <ChatSidebar
                    channels={sidebarChannels}
                    selectedChannelId={selectedChannelId}
                    onSelectChannel={setSelectedChannelId}
                    onNewChat={() => setNewChatOpen(true)}
                    onNewGroup={() => setNewGroupOpen(true)}
                    users={allUsers || []}
                    messages={sidebarMessages}
                />
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {selectedChannel ? (
                    <>
                        {/* Channel Header */}
                        <Box
                            sx={{
                                px: 3,
                                py: 1.5,
                                borderBottom: '1px solid #1a1a1a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                            }}
                        >
                            {selectedChannel.type === 'group' ? (
                                <TagRoundedIcon sx={{ fontSize: 18, color: '#666' }} />
                            ) : (
                                <ChatOutlinedIcon sx={{ fontSize: 18, color: '#666' }} />
                            )}
                            <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}
                            >
                                {selectedChannel.name}
                            </Typography>
                        </Box>

                        {/* Messages */}
                        <MessageList
                            messages={messageListMessages}
                            users={allUsers || []}
                            currentUserId={currentUser?.id || null}
                        />

                        {/* Input */}
                        <MessageInput
                            onSend={handleSendMessage}
                            channelName={selectedChannel.name}
                        />
                    </>
                ) : (
                    /* Empty State */
                    <Box
                        sx={{
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                        }}
                    >
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: 3,
                                bgcolor: 'rgba(255,255,255,0.04)',
                                border: '1px solid #1a1a1a',
                                display: 'grid',
                                placeItems: 'center',
                            }}
                        >
                            <ChatOutlinedIcon sx={{ fontSize: 36, color: '#444' }} />
                        </Box>
                        <Stack spacing={1} alignItems="center">
                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                                Your Messages
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', maxWidth: 320 }}>
                                Start a new conversation with a colleague or create a group chat for your team.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                variant="contained"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setNewChatOpen(true)}
                                sx={{
                                    bgcolor: '#fff',
                                    color: '#000',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    px: 3,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                                }}
                            >
                                New Chat
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<GroupAddRoundedIcon />}
                                onClick={() => setNewGroupOpen(true)}
                                sx={{
                                    borderColor: '#333',
                                    color: '#ccc',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    px: 3,
                                    '&:hover': { borderColor: '#555', color: '#fff' },
                                }}
                            >
                                New Group
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Box>

            {/* New Chat Dialog */}
            <Dialog
                open={newChatOpen}
                onClose={() => setNewChatOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#0a0a0a',
                        border: '1px solid #222',
                        borderRadius: 2,
                        minWidth: 360,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                    Start a new conversation
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" sx={{ color: '#666', mb: 2, display: 'block' }}>
                        Select a member to start chatting
                    </Typography>
                    <Stack spacing={1}>
                        {orgMembers.map((member: any) => (
                            <Box
                                key={String(member.id)}
                                onClick={() => handleCreateDM(member.id)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: 2,
                                    py: 1,
                                    borderRadius: 1.5,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        bgcolor: '#1565c0',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        color: '#fff',
                                    }}
                                >
                                    {member.name.charAt(0).toUpperCase()}
                                </Box>
                                <Typography variant="body2" sx={{ color: '#ccc', fontWeight: 500 }}>
                                    {member.name}
                                </Typography>
                            </Box>
                        ))}
                        {orgMembers.length === 0 && (
                            <Typography variant="body2" sx={{ color: '#555', textAlign: 'center', py: 2 }}>
                                No other members in this workspace yet.
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setNewChatOpen(false)} sx={{ color: '#666', textTransform: 'none' }}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New Group Dialog */}
            <Dialog
                open={newGroupOpen}
                onClose={() => setNewGroupOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#0a0a0a',
                        border: '1px solid #222',
                        borderRadius: 2,
                        minWidth: 360,
                    },
                }}
            >
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                    Create a group chat
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Group name"
                        fullWidth
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        sx={{
                            mb: 2,
                            mt: 1,
                            '& .MuiInputBase-root': { color: '#fff', bgcolor: '#111' },
                            '& .MuiInputLabel-root': { color: '#666' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: '#666', mb: 1, display: 'block' }}>
                        Select members
                    </Typography>
                    <Stack spacing={0.5}>
                        {orgMembers.map((member: any) => (
                            <FormControlLabel
                                key={String(member.id)}
                                control={
                                    <Checkbox
                                        checked={selectedMemberIds.includes(member.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedMemberIds([...selectedMemberIds, member.id]);
                                            } else {
                                                setSelectedMemberIds(selectedMemberIds.filter(id => id !== member.id));
                                            }
                                        }}
                                        sx={{ color: '#555', '&.Mui-checked': { color: '#0070f3' } }}
                                    />
                                }
                                label={
                                    <Typography variant="body2" sx={{ color: '#ccc' }}>
                                        {member.name}
                                    </Typography>
                                }
                            />
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setNewGroupOpen(false)} sx={{ color: '#666', textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateGroup}
                        disabled={!newChannelName.trim() || selectedMemberIds.length === 0}
                        variant="contained"
                        sx={{
                            bgcolor: '#fff',
                            color: '#000',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                            '&.Mui-disabled': { bgcolor: '#333', color: '#666' },
                        }}
                    >
                        Create Group
                    </Button>
                </DialogActions>
            </Dialog>
        </DashboardLayout>
    );
}
