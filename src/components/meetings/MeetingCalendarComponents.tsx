import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {
    ChatChannel as DbChatChannel,
    ChatScheduledMeeting as DbChatScheduledMeeting,
    User as DbUser,
} from '../../module_bindings/types';
import { chatColors } from '../../theme/chatColors';

export interface CalendarCellData {
    date: Date;
    day: number;
    key: string;
    meetings: DbChatScheduledMeeting[];
    count: number;
    liveCount: number;
    publicCount: number;
    conflictCount: number;
    isToday: boolean;
    isSelected: boolean;
    inCurrentMonth: boolean;
}

export interface MeetingTone {
    bg: string;
    border: string;
    label: string;
    color: string;
}

interface CalendarDayCellProps {
    cell: CalendarCellData;
    isDragging: boolean;
    onDrop: () => void;
    onSelect: () => void;
    channelsById: Map<string, DbChatChannel>;
    usersById: Map<string, DbUser>;
    currentUser: DbUser | null;
    orgMemberCount: number;
    channelMemberCountById: Map<string, number>;
    describeMeetingTone: (meeting: DbChatScheduledMeeting) => MeetingTone;
    avatarColorForName: (name: string) => string;
}

export function CalendarDayCell({
    cell,
    isDragging,
    onDrop,
    onSelect,
    channelsById,
    usersById,
    currentUser,
    orgMemberCount,
    channelMemberCountById,
    describeMeetingTone,
    avatarColorForName,
}: CalendarDayCellProps) {
    return (
        <Box
            onDragOver={(event) => {
                if (isDragging) event.preventDefault();
            }}
            onDrop={onDrop}
            onClick={onSelect}
            sx={{
                minHeight: { xs: 112, md: 126 },
                borderRadius: 1.45,
                border: cell.isSelected
                    ? '1px solid rgba(114,138,255,0.52)'
                    : isDragging
                      ? '1px dashed rgba(114,138,255,0.36)'
                      : '1px solid rgba(255,255,255,0.07)',
                bgcolor: cell.isSelected
                    ? 'rgba(114,138,255,0.12)'
                    : cell.isToday
                      ? 'rgba(56,200,114,0.08)'
                      : cell.inCurrentMonth
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.01)',
                p: 0.8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
                <Typography
                    sx={{
                        color: cell.inCurrentMonth ? '#e8edf8' : '#667081',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                    }}
                >
                    {cell.day}
                </Typography>
                {cell.count > 0 ? (
                    <Chip
                        label={cell.count}
                        size="small"
                        sx={{
                            height: 18,
                            minWidth: 18,
                            bgcolor:
                                cell.liveCount > 0
                                    ? 'rgba(56,200,114,0.18)'
                                    : 'rgba(255,255,255,0.08)',
                            color: cell.liveCount > 0 ? '#abefc5' : '#cad2df',
                            '& .MuiChip-label': { px: 0.55, fontSize: '0.58rem', fontWeight: 700 },
                        }}
                    />
                ) : null}
            </Stack>

            <Stack spacing={0.45} sx={{ mt: 0.7, minHeight: 0 }}>
                {cell.meetings.slice(0, 2).map((meeting) => {
                    const tone = describeMeetingTone(meeting);
                    const organizer = usersById.get(String(meeting.createdByUserId)) || currentUser;
                    const organizerName = organizer?.name || organizer?.email || 'Host';
                    const audienceLabel =
                        meeting.visibility === 'public'
                            ? `${orgMemberCount || 0} scope`
                            : `${channelMemberCountById.get(String(meeting.channelId)) || 0} in #${channelsById.get(String(meeting.channelId))?.name || 'channel'}`;

                    return (
                        <Box
                            key={String(meeting.id)}
                            sx={{
                                borderRadius: 1.1,
                                px: 0.7,
                                py: 0.6,
                                bgcolor: tone.bg,
                                border: tone.border,
                            }}
                        >
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                spacing={0.5}
                                sx={{ mb: 0.35 }}
                            >
                                <Typography
                                    sx={{ color: '#eff4ff', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}
                                >
                                    {new Date(Number(meeting.scheduledAt)).toLocaleTimeString([], {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </Typography>
                                <Typography
                                    sx={{
                                        color: tone.color,
                                        fontSize: '0.54rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {tone.label}
                                </Typography>
                            </Stack>
                            <Typography
                                sx={{
                                        color: '#dfe5f0',
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {meeting.title}
                            </Typography>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                spacing={0.45}
                                sx={{ mt: 0.45 }}
                            >
                                <Stack direction="row" alignItems="center" spacing={0.45} sx={{ minWidth: 0 }}>
                                    <Avatar
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            fontSize: '0.55rem',
                                            fontWeight: 800,
                                            bgcolor: avatarColorForName(organizerName),
                                        }}
                                    >
                                        {organizerName.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Typography
                                        sx={{
                                            color: '#9099a9',
                                            fontSize: '0.56rem',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {organizerName}
                                    </Typography>
                                </Stack>
                                <Typography
                                    sx={{
                                        color: '#7f8897',
                                        fontSize: '0.54rem',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                        ml: 0.6,
                                    }}
                                >
                                    {audienceLabel}
                                </Typography>
                            </Stack>
                        </Box>
                    );
                })}
                {cell.count > 2 ? (
                    <Typography sx={{ color: '#7d8593', fontSize: '0.62rem', fontWeight: 600 }}>
                        +{cell.count - 2} more
                    </Typography>
                ) : (
                    <Box sx={{ flex: 1 }} />
                )}
            </Stack>

            {(cell.publicCount > 0 || cell.liveCount > 0 || cell.count > 0 || cell.conflictCount > 0) ? (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.45, flexWrap: 'wrap' }}>
                    {cell.conflictCount > 0 ? (
                        <Typography
                            sx={{
                                color: '#f0a6b1',
                                fontSize: '0.56rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                            }}
                        >
                            {cell.conflictCount} conflict
                        </Typography>
                    ) : null}
                    {cell.liveCount > 0 ? (
                        <Typography sx={{ color: chatColors.success, fontSize: '0.56rem', fontWeight: 800, textTransform: 'uppercase' }}>
                            {cell.liveCount} live
                        </Typography>
                    ) : null}
                    {cell.publicCount > 0 ? (
                        <Typography sx={{ color: '#90a2ff', fontSize: '0.56rem', fontWeight: 800, textTransform: 'uppercase' }}>
                            {cell.publicCount} public
                        </Typography>
                    ) : null}
                    {cell.count > 0 ? (
                        <Typography sx={{ color: '#7f8897', fontSize: '0.56rem', fontWeight: 700 }}>
                            {cell.count} total
                        </Typography>
                    ) : null}
                </Stack>
            ) : null}
        </Box>
    );
}
