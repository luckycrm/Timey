import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AIWorkspacePage, AIStatusPill } from './AIPrimitives';
import { NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type OrgView = 'departments' | 'managers' | 'tree';

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

export function AIOrgPage() {
    const { aiAgents, members, usersById } = useAIWorkspaceData();

    const [view, setView] = useState<OrgView>('departments');

    const departments = useMemo(() => {
        const grouped = new Map<string, typeof aiAgents>();
        for (const agent of aiAgents) {
            const key = agent.department || 'General';
            const current = grouped.get(key) ?? [];
            current.push(agent);
            grouped.set(key, current);
        }
        return [...grouped.entries()]
            .map(([department, agents]) => ({
                department,
                agents,
                activeCount: agents.filter((a) => a.status === 'active').length,
                attentionCount: agents.filter((a) => ['attention', 'paused', 'error'].includes(a.status)).length,
                unownedCount: agents.filter((a) => a.managerUserId === NONE_U64).length,
            }))
            .sort((a, b) => b.agents.length - a.agents.length);
    }, [aiAgents]);

    const managerRows = useMemo(() => {
        const byManager = new Map<bigint, typeof aiAgents>();
        for (const agent of aiAgents) {
            if (agent.managerUserId === NONE_U64) continue;
            const current = byManager.get(agent.managerUserId) ?? [];
            current.push(agent);
            byManager.set(agent.managerUserId, current);
        }
        return [...byManager.entries()]
            .map(([managerId, agents]) => ({
                managerId,
                manager: usersById.get(managerId) ?? null,
                agents: [...agents].sort((a, b) => a.name.localeCompare(b.name)),
                activeCount: agents.filter((a) => a.status === 'active').length,
                attentionCount: agents.filter((a) => ['attention', 'paused', 'error'].includes(a.status)).length,
            }))
            .sort((a, b) => b.agents.length - a.agents.length);
    }, [aiAgents, usersById]);

    const unassigned = aiAgents.filter((a) => a.managerUserId === NONE_U64);
    const activeAgents = aiAgents.filter((a) => a.status === 'active');
    const attentionAgents = aiAgents.filter((a) => ['attention', 'paused', 'error'].includes(a.status));

    return (
        <AIWorkspacePage page="org">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Org
                </Typography>
                <Stack direction="row" spacing={0.75}>
                    {(['departments', 'managers', 'tree'] as OrgView[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                padding: '4px 10px',
                                border: '1px solid',
                                borderColor: view === v ? '#fff' : '#1a1a1a',
                                borderRadius: 4,
                                background: 'none',
                                cursor: 'pointer',
                                color: view === v ? '#fff' : '#555',
                                fontSize: '0.75rem',
                                textTransform: 'capitalize',
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </Stack>
            </Stack>

            {/* Summary line */}
            <Typography variant="caption" sx={{ color: '#555' }}>
                {aiAgents.length} agents — {activeAgents.length} active
                {attentionAgents.length > 0 && ` · ${attentionAgents.length} need attention`}
                {unassigned.length > 0 && ` · ${unassigned.length} unassigned`}
                {members.length > 0 && ` · ${members.length} workspace members`}
            </Typography>

            {/* Department view */}
            {view === 'departments' && (
                aiAgents.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>No agents yet.</Typography>
                    </Box>
                ) : (
                    <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                        {departments.map((group, i) => (
                            <Stack
                                key={group.department}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    px: 2,
                                    py: 1.5,
                                    borderBottom: i < departments.length - 1 ? '1px solid #1a1a1a' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Stack spacing={0.2}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{group.department}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {group.agents.length} agent{group.agents.length !== 1 ? 's' : ''} • {group.activeCount} active
                                        {group.unownedCount > 0 ? ` • ${group.unownedCount} unowned` : ''}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <AIStatusPill label={`${group.activeCount} active`} tone={group.activeCount > 0 ? 'success' : 'neutral'} />
                                    {group.attentionCount > 0 && <AIStatusPill label={`${group.attentionCount} flagged`} tone="danger" />}
                                </Stack>
                            </Stack>
                        ))}
                    </Box>
                )
            )}

            {/* Tree view */}
            {view === 'tree' && (
                aiAgents.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>No agents yet.</Typography>
                    </Box>
                ) : (
                    <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                        {/* Workspace root */}
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ px: 2, py: 1.25, borderBottom: '1px solid #1a1a1a', bgcolor: 'rgba(255,255,255,0.03)' }}
                        >
                            <Typography variant="body2" sx={{ color: '#7eb0ff', fontWeight: 700, letterSpacing: '0.04em' }}>
                                Workspace
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#555' }}>
                                {aiAgents.length} total · {activeAgents.length} active
                            </Typography>
                        </Stack>

                        {/* Departments as branches */}
                        {departments.map((group, dIdx) => (
                            <Box key={group.department}>
                                {/* Department row */}
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{
                                        pl: 3,
                                        pr: 2,
                                        py: 1,
                                        borderBottom: '1px solid #111',
                                        bgcolor: 'rgba(255,255,255,0.015)',
                                        borderLeft: '2px solid #2a2a2a',
                                        ml: 1,
                                    }}
                                >
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: group.activeCount > 0 ? '#38c872' : '#333' }} />
                                        <Typography variant="body2" sx={{ color: '#c8c8c8', fontWeight: 600 }}>
                                            {group.department}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: '#444' }}>
                                        {group.agents.length} agent{group.agents.length !== 1 ? 's' : ''}
                                    </Typography>
                                </Stack>

                                {/* Agents as leaves */}
                                {group.agents.map((agent, aIdx) => {
                                    const manager = agent.managerUserId !== NONE_U64 ? usersById.get(agent.managerUserId) : null;
                                    const isLast = aIdx === group.agents.length - 1 && dIdx === departments.length - 1;
                                    return (
                                        <Stack
                                            key={agent.id.toString()}
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            sx={{
                                                pl: 5,
                                                pr: 2,
                                                py: 0.9,
                                                borderBottom: isLast ? 'none' : '1px solid #111',
                                                borderLeft: '2px solid #1a1a1a',
                                                ml: 2,
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                            }}
                                        >
                                            <Stack spacing={0.1}>
                                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                                                    {agent.name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#444' }}>
                                                    {agent.role}
                                                    {manager ? ` · reports to ${manager.name || manager.email}` : ''}
                                                </Typography>
                                            </Stack>
                                            <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                        </Stack>
                                    );
                                })}
                            </Box>
                        ))}
                    </Box>
                )
            )}

            {/* Manager view */}
            {view === 'managers' && (
                <Stack spacing={1.5}>
                    {managerRows.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#555' }}>No manager assignments yet.</Typography>
                        </Box>
                    ) : managerRows.map((row) => (
                        <Stack key={row.managerId.toString()} spacing={0.75} sx={{ border: '1px solid #1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                            {/* Manager header */}
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ px: 2, py: 1.25, borderBottom: '1px solid #1a1a1a', bgcolor: 'rgba(255,255,255,0.02)' }}
                            >
                                <Stack spacing={0.15}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                                        {row.manager?.name || row.manager?.email || 'Unknown manager'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {row.agents.length} agent{row.agents.length !== 1 ? 's' : ''} • {row.activeCount} active
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.75}>
                                    {row.attentionCount > 0 && <AIStatusPill label={`${row.attentionCount} flagged`} tone="danger" />}
                                </Stack>
                            </Stack>
                            {/* Agent rows */}
                            {row.agents.map((agent, i) => (
                                <Stack
                                    key={agent.id.toString()}
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        borderBottom: i < row.agents.length - 1 ? '1px solid #111' : 'none',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                    }}
                                >
                                    <Stack spacing={0.1}>
                                        <Typography variant="body2" sx={{ color: '#c8c8c8', fontWeight: 500 }}>{agent.name}</Typography>
                                        <Typography variant="caption" sx={{ color: '#444' }}>{agent.role} • {agent.department || 'General'}</Typography>
                                    </Stack>
                                    <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                </Stack>
                            ))}
                        </Stack>
                    ))}

                    {/* Unassigned */}
                    {unassigned.length > 0 && (
                        <Stack spacing={0.75}>
                            <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Unassigned ({unassigned.length})
                            </Typography>
                            <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                                {unassigned.map((agent, i) => (
                                    <Stack
                                        key={agent.id.toString()}
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                            px: 2,
                                            py: 1.25,
                                            borderBottom: i < unassigned.length - 1 ? '1px solid #1a1a1a' : 'none',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                        }}
                                    >
                                        <Stack spacing={0.15}>
                                            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{agent.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#555' }}>{agent.role} • {agent.department || 'General'}</Typography>
                                        </Stack>
                                        <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                    </Stack>
                                ))}
                            </Box>
                        </Stack>
                    )}
                </Stack>
            )}
        </AIWorkspacePage>
    );
}

export const AiOrgPage = AIOrgPage;
