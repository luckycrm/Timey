import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import AddIcon from '@mui/icons-material/Add';
import ListIcon from '@mui/icons-material/List';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { AIWorkspacePage, AIStatusPill } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';
import { AiNewAgentDialog } from './AiNewAgentDialog';
import { formatRelativeTime, NONE_U64 } from './aiUtils';

type AgentTab = 'all' | 'active' | 'paused' | 'error';

const TABS: { value: AgentTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'error', label: 'Error' },
];

const ADAPTER_LABELS: Record<string, string> = {
    claude_local: 'Claude',
    codex_local: 'Codex',
    opencode_local: 'OpenCode',
    cursor: 'Cursor',
    openclaw_gateway: 'OpenClaw',
    process: 'Process',
    http: 'HTTP',
};

function statusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
    switch (status) {
        case 'active': return 'success';
        case 'attention':
        case 'error': return 'danger';
        case 'paused':
        case 'draft': return 'warning';
        default: return 'neutral';
    }
}

export function AIAgentsPage() {
    const {
        aiAgents,
        aiProjects,
        aiWakeupRequests,
        aiAgentRuntimeByAgentId,
    } = useAIWorkspaceData();

    const updateAiAgentStatus = useReducer(reducers.updateAiAgentStatus);
    const [tab, setTab] = useState<AgentTab>('all');
    const [view, setView] = useState<'list' | 'org'>('list');
    const [showTerminated, setShowTerminated] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [newAgentOpen, setNewAgentOpen] = useState(false);

    const now = Date.now();

    function matchesTab(status: string): boolean {
        if (status === 'terminated') return showTerminated;
        if (tab === 'all') return true;
        if (tab === 'active') return status === 'active';
        if (tab === 'paused') return status === 'paused' || status === 'draft';
        if (tab === 'error') return status === 'error' || status === 'attention';
        return true;
    }

    const filtered = aiAgents.filter((a) => matchesTab(a.status));

    const tabCount = (t: AgentTab) => {
        if (t === 'all') return aiAgents.filter((a) => a.status !== 'terminated' || showTerminated).length;
        if (t === 'active') return aiAgents.filter((a) => a.status === 'active').length;
        if (t === 'paused') return aiAgents.filter((a) => a.status === 'paused' || a.status === 'draft').length;
        if (t === 'error') return aiAgents.filter((a) => a.status === 'error' || a.status === 'attention').length;
        return 0;
    };

    // Live run map: agentId -> count of live wakeups
    const liveByAgent = useMemo(() => {
        const map = new Map<bigint, number>();
        for (const w of aiWakeupRequests) {
            if (!['queued', 'claimed', 'running'].includes(w.status)) continue;
            map.set(w.agentId, (map.get(w.agentId) ?? 0) + 1);
        }
        return map;
    }, [aiWakeupRequests]);

    // Org view: group by department
    const departments = useMemo(() => {
        const grouped = new Map<string, typeof aiAgents>();
        for (const agent of filtered) {
            const key = agent.department || 'General';
            const cur = grouped.get(key) ?? [];
            cur.push(agent);
            grouped.set(key, cur);
        }
        return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [filtered]);

    return (
        <AIWorkspacePage page="agents">
            {/* Header row */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Agents
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    {/* Filters dropdown */}
                    <Box sx={{ position: 'relative' }}>
                        <button
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            style={{
                                padding: '4px 10px',
                                border: '1px solid',
                                borderColor: filtersOpen || showTerminated ? '#ffffff' : '#1a1a1a',
                                borderRadius: 4,
                                background: 'none',
                                cursor: 'pointer',
                                color: filtersOpen || showTerminated ? '#fff' : '#555',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            Filters
                            {showTerminated && (
                                <span style={{ marginLeft: 3, padding: '0 4px', background: 'rgba(255,255,255,0.1)', borderRadius: 3, fontSize: '0.65rem' }}>1</span>
                            )}
                        </button>
                        {filtersOpen && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    mt: 0.5,
                                    zIndex: 50,
                                    width: 180,
                                    border: '1px solid #1a1a1a',
                                    bgcolor: '#0a0a0a',
                                    p: 0.5,
                                }}
                            >
                                <button
                                    onClick={() => setShowTerminated(!showTerminated)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '6px 8px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        color: '#c8c8c8',
                                        fontSize: '0.75rem',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: 13, height: 13, border: '1px solid #333', borderRadius: 2,
                                        background: showTerminated ? '#ffffff' : 'none',
                                    }}>
                                        {showTerminated && <span style={{ color: '#000', fontSize: 10, lineHeight: 1 }}>✓</span>}
                                    </span>
                                    Show terminated
                                </button>
                            </Box>
                        )}
                    </Box>

                    {/* View toggle */}
                    <Stack direction="row" sx={{ border: '1px solid #1a1a1a', borderRadius: '4px', overflow: 'hidden' }}>
                        <button
                            onClick={() => setView('list')}
                            title="List view"
                            style={{
                                padding: '4px 8px',
                                border: 'none',
                                background: view === 'list' ? 'rgba(255,255,255,0.08)' : 'none',
                                cursor: 'pointer',
                                color: view === 'list' ? '#fff' : '#555',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <ListIcon sx={{ fontSize: 14 }} />
                        </button>
                        <button
                            onClick={() => setView('org')}
                            title="Org view"
                            style={{
                                padding: '4px 8px',
                                border: 'none',
                                borderLeft: '1px solid #1a1a1a',
                                background: view === 'org' ? 'rgba(255,255,255,0.08)' : 'none',
                                cursor: 'pointer',
                                color: view === 'org' ? '#fff' : '#555',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <AccountTreeIcon sx={{ fontSize: 14 }} />
                        </button>
                    </Stack>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setNewAgentOpen(true)}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            borderColor: '#1a1a1a',
                            color: '#858585',
                            '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' },
                        }}
                    >
                        New Agent
                    </Button>
                </Stack>
            </Stack>

            {/* Tabs */}
            <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid #1a1a1a', mt: -0.5 }}>
                {TABS.map((t) => (
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
                        {tabCount(t.value) > 0 && (
                            <span style={{
                                marginLeft: 5,
                                fontSize: '0.7rem',
                                color: tab === t.value ? '#858585' : '#444',
                            }}>
                                {tabCount(t.value)}
                            </span>
                        )}
                    </button>
                ))}
            </Stack>

            {/* Count line */}
            {filtered.length > 0 && (
                <Typography variant="caption" sx={{ color: '#555' }}>
                    {filtered.length} agent{filtered.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* Empty states */}
            {aiAgents.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        No agents yet.
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{
                            mt: 2,
                            textTransform: 'none',
                            borderColor: '#1a1a1a',
                            color: '#858585',
                            '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' },
                        }}
                        onClick={() => setNewAgentOpen(true)}
                    >
                        Create your first agent
                    </Button>
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>
                            No agents match this filter.
                        </Typography>
                    </Box>
                </Box>
            ) : view === 'list' ? (
                /* List view */
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.map((agent) => {
                        const project = aiProjects.find((p) => p.id === agent.projectId);
                        const runtime = aiAgentRuntimeByAgentId.get(agent.id);
                        const liveCount = liveByAgent.get(agent.id) ?? 0;
                        const statusColor =
                            agent.status === 'active' ? '#38c872' :
                            agent.status === 'attention' || agent.status === 'error' ? '#ef4444' :
                            '#333';

                        return (
                            <Stack
                                key={agent.id.toString()}
                                direction="row"
                                alignItems="center"
                                spacing={2}
                                sx={{
                                    px: 2,
                                    py: 1.5,
                                    borderBottom: '1px solid #1a1a1a',
                                    '&:last-child': { borderBottom: 'none' },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                {/* Status dot */}
                                <Box
                                    sx={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        bgcolor: statusColor,
                                        flexShrink: 0,
                                    }}
                                />

                                {/* Name + meta */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {agent.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {agent.role}
                                        {agent.department ? ` • ${agent.department}` : ''}
                                        {project ? ` • ${project.name}` : ''}
                                    </Typography>
                                </Box>

                                {/* Right: live indicator / adapter / heartbeat / status chip / actions */}
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                    {/* Live run indicator */}
                                    {liveCount > 0 && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.75,
                                                px: 1,
                                                py: 0.25,
                                                borderRadius: '999px',
                                                bgcolor: 'rgba(59,130,246,0.12)',
                                            }}
                                        >
                                            <Box sx={{ position: 'relative', width: 8, height: 8 }}>
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: '50%',
                                                        bgcolor: '#3b82f6',
                                                        opacity: 0.75,
                                                        animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
                                                        '@keyframes ping': {
                                                            '0%': { transform: 'scale(1)', opacity: 0.75 },
                                                            '100%': { transform: 'scale(2)', opacity: 0 },
                                                        },
                                                    }}
                                                />
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: '50%',
                                                        bgcolor: '#3b82f6',
                                                    }}
                                                />
                                            </Box>
                                            <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.68rem' }}>
                                                Live{liveCount > 1 ? ` (${liveCount})` : ''}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Adapter type */}
                                    {runtime?.adapterType && (
                                        <Typography variant="caption" sx={{ color: '#555', fontFamily: 'monospace', width: 56, textAlign: 'right' }}>
                                            {ADAPTER_LABELS[runtime.adapterType] ?? runtime.adapterType}
                                        </Typography>
                                    )}

                                    {/* Last heartbeat */}
                                    <Typography variant="caption" sx={{ color: '#555', width: 64, textAlign: 'right' }}>
                                        {runtime?.lastHeartbeatAt && runtime.lastHeartbeatAt !== 0n && runtime.lastHeartbeatAt !== NONE_U64
                                            ? formatRelativeTime(runtime.lastHeartbeatAt, now)
                                            : '—'}
                                    </Typography>

                                    <Chip
                                        size="small"
                                        label={agent.status}
                                        sx={{
                                            fontSize: '0.7rem',
                                            height: 20,
                                            bgcolor: 'transparent',
                                            color: '#555',
                                            border: '1px solid #1a1a1a',
                                            borderRadius: '4px',
                                        }}
                                    />
                                    {agent.status === 'active' ? (
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                            onClick={() =>
                                                updateAiAgentStatus({ agentId: agent.id, status: 'paused' }).catch((error) => {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to pause agent');
                                                })
                                            }
                                        >
                                            Pause
                                        </Button>
                                    ) : agent.status !== 'terminated' ? (
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                            onClick={() =>
                                                updateAiAgentStatus({ agentId: agent.id, status: 'active' }).catch((error) => {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to activate agent');
                                                })
                                            }
                                        >
                                            Activate
                                        </Button>
                                    ) : null}
                                    <Button
                                        component="a"
                                        href={`/ai/agents/${agent.id.toString()}`}
                                        size="small"
                                        variant="text"
                                        sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                    >
                                        Details →
                                    </Button>
                                </Stack>
                            </Stack>
                        );
                    })}
                </Box>
            ) : (
                /* Org view — agents grouped by department */
                <Stack spacing={1.5}>
                    {departments.map(([dept, agents]) => (
                        <Box key={dept} sx={{ border: '1px solid #1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                            {/* Dept header */}
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ px: 2, py: 1.25, borderBottom: '1px solid #1a1a1a', bgcolor: 'rgba(255,255,255,0.02)' }}
                            >
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>{dept}</Typography>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <AIStatusPill
                                        label={`${agents.filter((a) => a.status === 'active').length} active`}
                                        tone={agents.some((a) => a.status === 'active') ? 'success' : 'neutral'}
                                    />
                                    {agents.some((a) => ['error', 'attention'].includes(a.status)) && (
                                        <AIStatusPill
                                            label={`${agents.filter((a) => ['error', 'attention'].includes(a.status)).length} flagged`}
                                            tone="danger"
                                        />
                                    )}
                                </Stack>
                            </Stack>
                            {/* Agent rows */}
                            {agents.map((agent, i) => {
                                const runtime = aiAgentRuntimeByAgentId.get(agent.id);
                                const liveCount = liveByAgent.get(agent.id) ?? 0;
                                return (
                                    <Stack
                                        key={agent.id.toString()}
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                            pl: 4,
                                            pr: 2,
                                            py: 1,
                                            borderBottom: i < agents.length - 1 ? '1px solid #111' : 'none',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                        }}
                                    >
                                        <Stack spacing={0.1}>
                                            <Typography variant="body2" sx={{ color: '#c8c8c8', fontWeight: 500 }}>{agent.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#444' }}>{agent.role}</Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            {liveCount > 0 && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: '999px', bgcolor: 'rgba(59,130,246,0.12)' }}>
                                                    <Box sx={{ position: 'relative', width: 7, height: 7 }}>
                                                        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', bgcolor: '#3b82f6', opacity: 0.75, animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite', '@keyframes ping': { '0%': { transform: 'scale(1)', opacity: 0.75 }, '100%': { transform: 'scale(2)', opacity: 0 } } }} />
                                                        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', bgcolor: '#3b82f6' }} />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.68rem' }}>Live{liveCount > 1 ? ` (${liveCount})` : ''}</Typography>
                                                </Box>
                                            )}
                                            {runtime?.adapterType && (
                                                <Typography variant="caption" sx={{ color: '#555', fontFamily: 'monospace' }}>
                                                    {ADAPTER_LABELS[runtime.adapterType] ?? runtime.adapterType}
                                                </Typography>
                                            )}
                                            <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                        </Stack>
                                    </Stack>
                                );
                            })}
                        </Box>
                    ))}
                </Stack>
            )}

            <AiNewAgentDialog open={newAgentOpen} onClose={() => setNewAgentOpen(false)} />
        </AIWorkspacePage>
    );
}

export const AiAgentsPage = AIAgentsPage;
