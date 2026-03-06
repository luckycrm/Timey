import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import SearchIcon from '@mui/icons-material/Search';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';

interface ChatChannel {
    id: bigint;
    name: string;
    type: string;
    created_at: bigint;
}

interface ChatSidebarProps {
    channels: ChatChannel[];
    selectedChannelId: bigint | null;
    onSelectChannel: (id: bigint) => void;
    onNewChat: () => void;
    onNewGroup: () => void;
    users: any[];
    messages: any[];
}

export function ChatSidebar({
    channels,
    selectedChannelId,
    onSelectChannel,
    onNewChat,
    onNewGroup,
    users,
    messages,
}: ChatSidebarProps) {
    const [search, setSearch] = useState('');

    const filteredChannels = channels.filter(ch =>
        ch.name.toLowerCase().includes(search.toLowerCase())
    );

    const getLastMessage = (channelId: bigint) => {
        const channelMessages = messages
            .filter(m => m.channel_id === channelId)
            .sort((a, b) => Number(b.created_at) - Number(a.created_at));
        return channelMessages[0] || null;
    };

    const getSenderName = (senderId: bigint) => {
        const user = users.find(u => u.id === senderId);
        return user?.name || 'Unknown';
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
                    <Stack spacing={0.5}>
                        {filteredChannels.map((channel) => {
                            const isSelected = selectedChannelId === channel.id;
                            const lastMsg = getLastMessage(channel.id);

                            return (
                                <Box
                                    key={String(channel.id)}
                                    onClick={() => onSelectChannel(channel.id)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        px: 1.5,
                                        py: 1,
                                        borderRadius: 1.5,
                                        cursor: 'pointer',
                                        bgcolor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                        '&:hover': {
                                            bgcolor: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                        },
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <Avatar
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            bgcolor: channel.type === 'group' ? '#1565c0' : '#00695c',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {channel.type === 'group' ? (
                                            <TagRoundedIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                            <PersonRoundedIcon sx={{ fontSize: 16 }} />
                                        )}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: isSelected ? 700 : 500,
                                                color: isSelected ? '#fff' : '#ccc',
                                                fontSize: '0.85rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {channel.name}
                                        </Typography>
                                        {lastMsg && (
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: '#666',
                                                    fontSize: '0.7rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    display: 'block',
                                                }}
                                            >
                                                {getSenderName(lastMsg.sender_id)}: {lastMsg.content}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </Box>
    );
}
