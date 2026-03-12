import { useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, NONE_U64 } from './aiUtils';
import { humanizeRuntimeToken } from './AIRuntimeDetailBlocks';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type FeedSource = 'all' | 'activity' | 'run_event';

function inferEntityType(event: { agentId: bigint; taskId: bigint; projectId: bigint; goalId: bigint; approvalId: bigint }): string {
    if (event.agentId !== 0n && event.agentId !== NONE_U64) return 'agent';
    if (event.taskId !== 0n && event.taskId !== NONE_U64) return 'task';
    if (event.approvalId !== 0n && event.approvalId !== NONE_U64) return 'approval';
    if (event.projectId !== 0n && event.projectId !== NONE_U64) return 'project';
    if (event.goalId !== 0n && event.goalId !== NONE_U64) return 'goal';
    return 'system';
}

const SOURCE_TABS: { value: FeedSource; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'activity', label: 'Workspace events' },
    { value: 'run_event', label: 'Run events' },
];

export function AIActivityPage() {
    const {
        aiActivities,
        aiAgents,
        aiRunEvents,
        usersById,
    } = useAIWorkspaceData();

    const [tab, setTab] = useState<FeedSource>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [entityFilter, setEntityFilter] = useState<string>('all');

    const now = Date.now();

    const activityRows = [...aiActivities]
        .sort((l, r) => Number(r.createdAt - l.createdAt))
        .map((event) => ({
            key: `activity-${event.id.toString()}`,
            createdAt: event.createdAt,
            source: 'activity' as const,
            title: event.description,
            subtitle: humanizeRuntimeToken(event.eventType),
            actorLabel: usersById.get(event.actorUserId)?.name || usersById.get(event.actorUserId)?.email || 'System',
            agentName: aiAgents.find((a) => a.id === event.agentId)?.name || '',
            level: '',
            entityType: inferEntityType(event),
        }));

    const runEventRows = [...aiRunEvents]
        .sort((l, r) => Number(r.createdAt - l.createdAt))
        .map((event) => ({
            key: `run-event-${event.id.toString()}`,
            createdAt: event.createdAt,
            source: 'run_event' as const,
            title: event.message,
            subtitle: `${humanizeRuntimeToken(event.eventType)} • ${humanizeRuntimeToken(event.level)}`,
            actorLabel: usersById.get(event.actorUserId)?.name || usersById.get(event.actorUserId)?.email || 'Runtime',
            agentName: aiAgents.find((a) => a.id === event.agentId)?.name || '',
            level: event.level,
            entityType: 'agent',
        }));

    const combinedFeed = [...activityRows, ...runEventRows]
        .sort((l, r) => Number(r.createdAt - l.createdAt));

    const filtered = combinedFeed.filter((row) => {
        if (tab !== 'all' && row.source !== tab) return false;
        if (levelFilter !== 'all' && row.source === 'run_event' && row.level !== levelFilter) return false;
        if (entityFilter !== 'all' && row.entityType !== entityFilter) return false;
        return true;
    });

    const levels = ['error', 'warning', 'info', 'debug'];
    const entityTypes = [...new Set(activityRows.map((r) => r.entityType))].sort();

    return (
        <AIWorkspacePage page="activity">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Activity
                </Typography>
                <Stack direction="row" spacing={1}>
                    <TextField
                        select
                        size="small"
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        sx={{
                            minWidth: 110,
                            '& .MuiInputBase-root': { fontSize: '0.8rem', color: '#555', borderColor: '#1a1a1a' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1a1a1a' },
                        }}
                    >
                        <MenuItem value="all">All types</MenuItem>
                        {entityTypes.map((type) => (
                            <MenuItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        size="small"
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value)}
                        sx={{
                            minWidth: 120,
                            '& .MuiInputBase-root': { fontSize: '0.8rem', color: '#555', borderColor: '#1a1a1a' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1a1a1a' },
                        }}
                    >
                        <MenuItem value="all">All levels</MenuItem>
                        {levels.map((l) => (
                            <MenuItem key={l} value={l}>{l}</MenuItem>
                        ))}
                    </TextField>
                </Stack>
            </Stack>

            {/* Source tabs */}
            <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid #1a1a1a', mt: -0.5 }}>
                {SOURCE_TABS.map((t) => {
                    const count = t.value === 'all' ? combinedFeed.length : t.value === 'activity' ? activityRows.length : runEventRows.length;
                    return (
                        <button
                            key={t.value}
                            onClick={() => setTab(t.value)}
                            style={{
                                padding: '6px 14px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: tab === t.value ? '#ffffff' : '#555',
                                borderBottom: tab === t.value ? '2px solid #ffffff' : '2px solid transparent',
                                fontSize: '0.8rem',
                                fontWeight: tab === t.value ? 600 : 400,
                                transition: 'color 0.15s',
                            }}
                        >
                            {t.label}
                            {count > 0 && (
                                <span style={{ marginLeft: 5, fontSize: '0.7rem', color: tab === t.value ? '#858585' : '#444' }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </Stack>

            {/* Count */}
            {filtered.length > 0 && (
                <Typography variant="caption" sx={{ color: '#555' }}>
                    {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* Feed */}
            {filtered.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        No activity recorded yet.
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.slice(0, 50).map((row) => (
                        <Stack
                            key={row.key}
                            direction="row"
                            alignItems="flex-start"
                            spacing={2}
                            sx={{
                                px: 2,
                                py: 1.5,
                                borderBottom: '1px solid #1a1a1a',
                                '&:last-child': { borderBottom: 'none' },
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                            }}
                        >
                            {/* Level dot for run events */}
                            {row.source === 'run_event' && (
                                <Box
                                    sx={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        mt: 0.75,
                                        flexShrink: 0,
                                        bgcolor:
                                            row.level === 'error' ? '#ef4444' :
                                            row.level === 'warning' ? '#f59e0b' :
                                            row.level === 'info' ? '#7eb0ff' : '#333',
                                    }}
                                />
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                    {row.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585', display: 'block', mt: 0.2 }}>
                                    {row.source === 'run_event' ? 'Run event' : 'Workspace'} • {row.subtitle}
                                    {row.actorLabel ? ` • ${row.actorLabel}` : ''}
                                    {row.agentName ? ` • ${row.agentName}` : ''}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#555', flexShrink: 0 }}>
                                {formatRelativeTime(row.createdAt, now)}
                            </Typography>
                        </Stack>
                    ))}
                </Box>
            )}
        </AIWorkspacePage>
    );
}

export const AiActivityPage = AIActivityPage;
