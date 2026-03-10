import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import AddIcon from '@mui/icons-material/Add';
import { AIWorkspacePage } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';
import { AiNewAgentDialog } from './AiNewAgentDialog';

type AgentTab = 'all' | 'active' | 'paused' | 'attention';

const TABS: { value: AgentTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'attention', label: 'Attention' },
];

export function AIAgentsPage() {
    const {
        aiAgents,
        aiProjects,
        aiWakeupRequests,
    } = useAIWorkspaceData();

    const updateAiAgentStatus = useReducer(reducers.updateAiAgentStatus);
    const [tab, setTab] = useState<AgentTab>('all');
    const [newAgentOpen, setNewAgentOpen] = useState(false);

    const filtered = aiAgents.filter((agent) => {
        if (tab === 'active') return agent.status === 'active';
        if (tab === 'paused') return agent.status === 'paused' || agent.status === 'draft';
        if (tab === 'attention') return agent.status === 'attention';
        return true;
    });

    const tabCount = (t: AgentTab) => {
        if (t === 'all') return aiAgents.length;
        if (t === 'active') return aiAgents.filter((a) => a.status === 'active').length;
        if (t === 'paused') return aiAgents.filter((a) => a.status === 'paused' || a.status === 'draft').length;
        if (t === 'attention') return aiAgents.filter((a) => a.status === 'attention').length;
        return 0;
    };

    return (
        <AIWorkspacePage page="agents">
            {/* Header row */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Agents
                </Typography>
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

            {/* Agent list */}
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
            ) : (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.map((agent) => {
                        const project = aiProjects.find((p) => p.id === agent.projectId);
                        const liveWakeupCount = aiWakeupRequests.filter(
                            (w) => w.agentId === agent.id && ['queued', 'claimed', 'running'].includes(w.status)
                        ).length;
                        const statusColor =
                            agent.status === 'active' ? '#38c872' :
                            agent.status === 'attention' ? '#ff9800' : '#333';

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
                                        {liveWakeupCount > 0 ? ` • ${liveWakeupCount} live wakeup${liveWakeupCount !== 1 ? 's' : ''}` : ''}
                                    </Typography>
                                </Box>

                                {/* Right: status chip + actions */}
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
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
                                    ) : (
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
                                    )}
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
            )}

            <AiNewAgentDialog open={newAgentOpen} onClose={() => setNewAgentOpen(false)} />
        </AIWorkspacePage>
    );
}

export const AiAgentsPage = AIAgentsPage;
