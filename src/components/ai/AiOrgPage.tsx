import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type OrgMode = 'coverage' | 'managers';
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function statusTone(status: string): Tone {
    switch (status) {
        case 'active':
            return 'success';
        case 'attention':
        case 'error':
            return 'danger';
        case 'paused':
        case 'draft':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function AIOrgPage() {
    const {
        aiAgents,
        members,
        usersById,
    } = useAIWorkspaceData();

    const [mode, setMode] = useState<OrgMode>('coverage');

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
                activeCount: agents.filter((agent) => agent.status === 'active').length,
                attentionCount: agents.filter((agent) => ['attention', 'paused', 'error'].includes(agent.status)).length,
                unownedCount: agents.filter((agent) => agent.managerUserId === NONE_U64).length,
            }))
            .sort((left, right) => right.agents.length - left.agents.length);
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
                agents: [...agents].sort((left, right) => {
                    if (left.status !== right.status) return left.status.localeCompare(right.status);
                    return left.name.localeCompare(right.name);
                }),
                activeCount: agents.filter((agent) => agent.status === 'active').length,
                attentionCount: agents.filter((agent) => ['attention', 'paused', 'error'].includes(agent.status)).length,
            }))
            .sort((left, right) => right.agents.length - left.agents.length);
    }, [aiAgents, usersById]);

    const unassignedAgents = aiAgents.filter((agent) => agent.managerUserId === NONE_U64);
    const attentionAgents = aiAgents.filter((agent) => ['attention', 'paused', 'error'].includes(agent.status));
    const activeAgents = aiAgents.filter((agent) => agent.status === 'active');
    const openSeats = Math.max(0, members.length - aiAgents.length);

    return (
        <AIWorkspacePage page="org">
            <AIPageIntro
                eyebrow="Org"
                title="See how AI work is staffed across the workspace"
                description="This page now reads like an operating roster: which departments are covered, which managers are carrying load, and where AI roles still have no owner."
                actionSlot={
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant={mode === 'coverage' ? 'contained' : 'outlined'}
                            sx={{ textTransform: 'none' }}
                            onClick={() => setMode('coverage')}
                        >
                            Coverage view
                        </Button>
                        <Button
                            variant={mode === 'managers' ? 'contained' : 'outlined'}
                            sx={{ textTransform: 'none' }}
                            onClick={() => setMode('managers')}
                        >
                            Manager view
                        </Button>
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Active AI roles" value={String(activeAgents.length)} caption={`${aiAgents.length} total roles on the roster`} tone="success" />
                <AIStatCard label="Managers attached" value={String(managerRows.length)} caption={`${unassignedAgents.length} agents still need a manager`} tone="info" />
                <AIStatCard label="Attention needed" value={String(attentionAgents.length)} caption="Paused, error, or flagged for follow-up" tone="warning" />
                <AIStatCard label="Open seats" value={String(openSeats)} caption="Approximate gap versus human workspace headcount" tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                {mode === 'coverage' ? (
                    <>
                        <AISectionCard eyebrow="Coverage" title="Department coverage" description="Use this view to see where AI is staffed, thin, or missing ownership.">
                            <Stack spacing={1.15}>
                                {departments.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                        No agents exist yet, so there is no AI org coverage to show.
                                    </Typography>
                                ) : departments.map((group) => (
                                    <Stack
                                        key={group.department}
                                        direction={{ xs: 'column', md: 'row' }}
                                        justifyContent="space-between"
                                        spacing={1}
                                        sx={{
                                            p: 1.4,
                                            borderRadius: '14px',
                                            border: '1px solid #1a1a1a',
                                            bgcolor: 'rgba(255,255,255,0.015)',
                                        }}
                                    >
                                        <Stack spacing={0.45}>
                                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                                {group.department}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                                {group.agents.length} roles • {group.activeCount} active • {group.attentionCount} need attention
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#666666' }}>
                                                {group.unownedCount > 0 ? `${group.unownedCount} roles need a manager assigned.` : 'Manager coverage is in place.'}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
                                            <AIStatusPill label={`${group.activeCount} active`} tone={group.activeCount > 0 ? 'success' : 'warning'} />
                                            {group.attentionCount > 0 ? <AIStatusPill label={`${group.attentionCount} flagged`} tone="danger" /> : null}
                                            {group.unownedCount > 0 ? <AIStatusPill label={`${group.unownedCount} unowned`} tone="warning" /> : null}
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                        </AISectionCard>

                        <AISectionCard eyebrow="Gaps" title="Coverage gaps" description="These are the quickest interventions to improve operator control.">
                            <Stack spacing={1.15}>
                                <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.7 }}>
                                    {unassignedAgents.length} AI roles do not have a human manager attached yet.
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.7 }}>
                                    {attentionAgents.length} roles are paused, failing, or explicitly flagged for attention.
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                    Open seats are only a rough proxy. They compare workspace members to AI roles until a richer staffing model exists.
                                </Typography>
                            </Stack>
                        </AISectionCard>
                    </>
                ) : (
                    <>
                        <AISectionCard eyebrow="Managers" title="Manager-to-agent view" description="This is the honest first org chart for Timey: human managers and the AI roles they directly own.">
                            <Stack spacing={1.15}>
                                {managerRows.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                        No manager assignments exist yet.
                                    </Typography>
                                ) : managerRows.map((row) => (
                                    <Stack
                                        key={row.managerId.toString()}
                                        spacing={1}
                                        sx={{
                                            p: 1.4,
                                            borderRadius: '14px',
                                            border: '1px solid #1a1a1a',
                                            bgcolor: 'rgba(255,255,255,0.015)',
                                        }}
                                    >
                                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                                            <Stack spacing={0.35}>
                                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 650 }}>
                                                    {row.manager?.name || row.manager?.email || 'Unknown manager'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                                    {row.agents.length} assigned agents • {row.activeCount} active • {row.attentionCount} need attention
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                                <AIStatusPill label={`${row.agents.length} roles`} tone="info" />
                                                {row.attentionCount > 0 ? <AIStatusPill label={`${row.attentionCount} flagged`} tone="danger" /> : null}
                                            </Stack>
                                        </Stack>

                                        <Stack spacing={0.9}>
                                            {row.agents.map((agent) => (
                                                <Stack
                                                    key={agent.id.toString()}
                                                    direction={{ xs: 'column', md: 'row' }}
                                                    justifyContent="space-between"
                                                    spacing={1}
                                                    sx={{
                                                        p: 1.15,
                                                        borderRadius: '12px',
                                                        bgcolor: 'rgba(255,255,255,0.035)',
                                                    }}
                                                >
                                                    <Stack spacing={0.35}>
                                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                                            {agent.name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                                            {agent.role} • {agent.department || 'General'}
                                                        </Typography>
                                                    </Stack>
                                                    <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                        </AISectionCard>

                        <AISectionCard eyebrow="Unassigned" title="Roles without a manager" description="These agents are active in the roster but still have no direct human owner.">
                            <Stack spacing={1.05}>
                                {unassignedAgents.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                        Every AI role has a manager assigned.
                                    </Typography>
                                ) : unassignedAgents.map((agent) => (
                                    <Stack
                                        key={agent.id.toString()}
                                        direction={{ xs: 'column', md: 'row' }}
                                        justifyContent="space-between"
                                        spacing={1}
                                        sx={{
                                            p: 1.3,
                                            borderRadius: '14px',
                                            border: '1px solid #1a1a1a',
                                            bgcolor: 'rgba(255,255,255,0.015)',
                                        }}
                                    >
                                        <Stack spacing={0.35}>
                                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                                {agent.name}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                                {agent.role} • {agent.department || 'General'}
                                            </Typography>
                                        </Stack>
                                        <AIStatusPill label={agent.status} tone={statusTone(agent.status)} />
                                    </Stack>
                                ))}
                            </Stack>
                        </AISectionCard>
                    </>
                )}
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiOrgPage = AIOrgPage;
