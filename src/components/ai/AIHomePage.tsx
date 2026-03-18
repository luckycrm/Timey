import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from '@tanstack/react-router';
import { AiPriorityDistributionChart, AiRunActivityChart, AiStatusDonut, AiSuccessRateCard } from './AiActivityCharts';
import { AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, formatUsd, microusdToUsd } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

function startOfWeek(date: Date) {
    const clone = new Date(date);
    const day = clone.getDay();
    clone.setHours(0, 0, 0, 0);
    clone.setDate(clone.getDate() - day);
    return clone.getTime();
}

function titleCase(value: string) {
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function AIHomePage() {
    const navigate = useNavigate();
    const {
        aiActivities,
        aiAgentRuntimes,
        aiAgents,
        aiAdapterSessions,
        aiApprovals,
        aiGoals,
        aiProjects,
        aiRunEvents,
        aiRuns,
        aiWakeupRequests,
        aiTasks,
        usersById,
    } = useAIWorkspaceData();

    const now = Date.now();
    const weekStart = startOfWeek(new Date(now));

    const activeAgents = aiAgents.filter((agent) => agent.status === 'active');
    const pendingApprovals = aiApprovals.filter((approval) => approval.status === 'pending');
    const openTasks = aiTasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.status));
    const staleTasks = aiTasks.filter((task) => task.status !== 'completed' && Number(task.updatedAt) < now - 3 * 24 * 60 * 60 * 1000);
    const blockedTasks = aiTasks.filter((task) => task.status === 'blocked');
    const failedRuns = aiRuns.filter((run) => run.status === 'failed');
    const liveRuns = aiRuns.filter((run) => run.status === 'running');
    const openWakeups = aiWakeupRequests.filter((wakeup) => ['queued', 'claimed', 'running'].includes(wakeup.status));
    const runtimeAttachedAgents = aiAgents.filter((agent) => aiAgentRuntimes.some((runtime) => runtime.agentId === agent.id));
    const activeAdapterSessions = aiAdapterSessions.filter((session) => session.status === 'active');
    const weeklySpend = aiRuns
        .filter((run) => Number(run.createdAt) >= weekStart)
        .reduce((total, run) => total + microusdToUsd(run.costMicrousd), 0);

    const actionQueue = [
        {
            id: 'approvals',
            title: 'Clear the approval queue',
            detail: `${pendingApprovals.length} approvals waiting`,
            tone: 'warning' as const,
            visible: pendingApprovals.length > 0,
            onClick: () => navigate({ to: '/ai/approvals' }),
        },
        {
            id: 'stale',
            title: 'Resolve stale tasks',
            detail: `${staleTasks.length} tasks not moved in 3+ days`,
            tone: 'warning' as const,
            visible: staleTasks.length > 0,
            onClick: () => navigate({ to: '/ai/inbox' }),
        },
        {
            id: 'blocked',
            title: 'Unblock execution',
            detail: `${blockedTasks.length} tasks explicitly blocked`,
            tone: 'danger' as const,
            visible: blockedTasks.length > 0,
            onClick: () => navigate({ to: '/ai/tasks' }),
        },
        {
            id: 'failures',
            title: 'Review failed runs',
            detail: `${failedRuns.length} failed runs`,
            tone: 'danger' as const,
            visible: failedRuns.length > 0,
            onClick: () => navigate({ to: '/ai/activity' }),
        },
    ].filter((item) => item.visible);

    const activeAgentRows = activeAgents
        .map((agent) => {
            const runtime = aiAgentRuntimes.find((row) => row.agentId === agent.id) ?? null;
            const agentRuns = aiRuns.filter((run) => run.agentId === agent.id && ['queued', 'running', 'waiting_approval'].includes(run.status));
            const agentWakeups = aiWakeupRequests.filter((wakeup) => wakeup.agentId === agent.id && ['queued', 'claimed', 'running'].includes(wakeup.status));
            const agentSessions = aiAdapterSessions.filter((session) => session.agentId === agent.id && session.status === 'active');
            const project = aiProjects.find((project) => project.id === agent.projectId) ?? null;
            return { agent, runtime, project, runCount: agentRuns.length, wakeupCount: agentWakeups.length, sessionCount: agentSessions.length };
        })
        .sort((left, right) => (right.runCount + right.wakeupCount + right.sessionCount) - (left.runCount + left.wakeupCount + left.sessionCount))
        .slice(0, 6);

    const portfolioRows = [...aiProjects]
        .sort((left, right) => Number(right.updatedAt - left.updatedAt))
        .slice(0, 5)
        .map((project) => {
            const projectTasks = aiTasks.filter((task) => task.projectId === project.id);
            const projectGoals = aiGoals.filter((goal) => goal.projectId === project.id);
            const staffedAgents = aiAgents.filter((agent) => agent.projectId === project.id);
            const owner = usersById.get(project.ownerUserId) ?? null;
            const avgProgress = projectGoals.length === 0
                ? 0
                : Math.round(projectGoals.reduce((total, goal) => total + Number(goal.progressPct), 0) / projectGoals.length);
            return { project, owner, staffedAgents, projectTasks, avgProgress };
        });

    const recentFeed = [
        ...aiActivities.map((event) => ({
            key: `activity-${event.id.toString()}`,
            createdAt: event.createdAt,
            title: event.description,
            label: titleCase(event.eventType),
            tone: event.eventType.includes('failed') ? 'danger' as const : event.eventType.includes('approval') ? 'warning' as const : 'info' as const,
        })),
        ...aiRunEvents.map((event) => ({
            key: `run-event-${event.id.toString()}`,
            createdAt: event.createdAt,
            title: event.message,
            label: titleCase(event.eventType),
            tone: event.level === 'error' ? 'danger' as const : event.level === 'warning' ? 'warning' as const : 'neutral' as const,
        })),
    ]
        .sort((left, right) => Number(right.createdAt - left.createdAt))
        .slice(0, 10);

    const toneColor = (tone: string) =>
        tone === 'danger' ? '#e33d4f' : tone === 'warning' ? '#ff9800' : tone === 'success' ? '#38c872' : '#555';

    return (
        <AIWorkspacePage page="home">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Overview
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: 'none', color: '#555', fontSize: '0.8rem', '&:hover': { color: '#fff' } }}
                        onClick={() => navigate({ to: '/ai/agents' })}
                    >
                        Agents
                    </Button>
                    <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: 'none', color: '#555', fontSize: '0.8rem', '&:hover': { color: '#fff' } }}
                        onClick={() => navigate({ to: '/ai/tasks' })}
                    >
                        Tasks
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            borderColor: '#1a1a1a',
                            color: '#858585',
                            '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' },
                        }}
                        onClick={() => navigate({ to: '/ai/inbox' })}
                    >
                        Inbox
                    </Button>
                </Stack>
            </Stack>

            {/* Compact stat row */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 0,
                    border: '1px solid #1a1a1a',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                {[
                    { label: 'Active agents', value: String(activeAgents.length), sub: `${runtimeAttachedAgents.length} with runtimes` },
                    { label: 'Open tasks', value: String(openTasks.length), sub: `${blockedTasks.length} blocked` },
                    { label: 'Approvals pending', value: String(pendingApprovals.length), sub: `${staleTasks.length} stale tasks` },
                    { label: 'Spend this week', value: formatUsd(weeklySpend), sub: `${liveRuns.length} live • ${openWakeups.length} wakeups • ${activeAdapterSessions.length} sessions` },
                ].map((stat, idx) => (
                    <Box
                        key={stat.label}
                        sx={{
                            px: 2,
                            py: 1.5,
                            borderRight: idx < 3 ? '1px solid #1a1a1a' : 'none',
                        }}
                    >
                        <Typography variant="caption" sx={{ color: '#555', display: 'block' }}>
                            {stat.label}
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, my: 0.2, fontSize: '1.1rem' }}>
                            {stat.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#444' }}>
                            {stat.sub}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Charts row */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                }}
            >
                <AiRunActivityChart runs={aiRuns} />
                <AiPriorityDistributionChart tasks={aiTasks} />
                <AiStatusDonut tasks={aiTasks} />
                <AiSuccessRateCard runs={aiRuns} />
            </Box>

            {/* Two-column content area */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                }}
            >
                {/* Action queue */}
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1a1a1a' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>Action queue</Typography>
                        {actionQueue.length === 0 && (
                            <Typography variant="caption" sx={{ color: '#38c872' }}>All clear</Typography>
                        )}
                    </Stack>
                    <Box>
                        {actionQueue.length === 0 ? (
                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#555' }}>No blockers right now.</Typography>
                            </Box>
                        ) : actionQueue.map((item) => (
                            <Stack
                                key={item.id}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                spacing={2}
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: '1px solid #1a1a1a',
                                    '&:last-child': { borderBottom: 'none' },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: toneColor(item.tone) }}>
                                        {item.detail}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                    onClick={item.onClick}
                                >
                                    Go →
                                </Button>
                            </Stack>
                        ))}
                    </Box>
                </Box>

                {/* Active agents */}
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1a1a1a' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>Active agents</Typography>
                        <Button
                            size="small"
                            variant="text"
                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 0 }}
                            onClick={() => navigate({ to: '/ai/agents' })}
                        >
                            All agents →
                        </Button>
                    </Stack>
                    <Box>
                        {activeAgentRows.length === 0 ? (
                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#555' }}>No active agents.</Typography>
                            </Box>
                        ) : activeAgentRows.map((row) => (
                            <Stack
                                key={row.agent.id.toString()}
                                direction="row"
                                alignItems="center"
                                spacing={2}
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: '1px solid #1a1a1a',
                                    '&:last-child': { borderBottom: 'none' },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#38c872', flexShrink: 0 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                        {row.agent.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {row.agent.role}
                                        {row.project ? ` • ${row.project.name}` : ''}
                                        {row.runCount > 0 ? ` • ${row.runCount} runs` : ''}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                    onClick={() => navigate({ to: '/ai/agents/$agentId', params: { agentId: row.agent.id.toString() } })}
                                >
                                    Open →
                                </Button>
                            </Stack>
                        ))}
                    </Box>
                </Box>

                {/* Portfolio */}
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1a1a1a' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>Recent projects</Typography>
                        <Button
                            size="small"
                            variant="text"
                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 0 }}
                            onClick={() => navigate({ to: '/ai/projects' })}
                        >
                            All projects →
                        </Button>
                    </Stack>
                    <Box>
                        {portfolioRows.length === 0 ? (
                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#555' }}>No projects yet.</Typography>
                            </Box>
                        ) : portfolioRows.map((row) => (
                            <Stack
                                key={row.project.id.toString()}
                                direction="row"
                                alignItems="center"
                                spacing={2}
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: '1px solid #1a1a1a',
                                    '&:last-child': { borderBottom: 'none' },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                        {row.project.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {row.staffedAgents.length} agents • {row.projectTasks.length} tasks • {row.avgProgress}% progress
                                        {' • '}
                                        {formatRelativeTime(row.project.updatedAt, now)}
                                    </Typography>
                                </Box>
                                <Chip
                                    size="small"
                                    label={row.project.status}
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: 20,
                                        bgcolor: 'transparent',
                                        color: row.project.status === 'watching' ? '#ff9800' : row.project.status === 'active' ? '#38c872' : '#555',
                                        border: '1px solid #1a1a1a',
                                        borderRadius: '4px',
                                    }}
                                />
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                    onClick={() => navigate({ to: '/ai/projects/$projectId', params: { projectId: row.project.id.toString() } })}
                                >
                                    Open →
                                </Button>
                            </Stack>
                        ))}
                    </Box>
                </Box>

                {/* Activity feed */}
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1a1a1a' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>Recent activity</Typography>
                        <Button
                            size="small"
                            variant="text"
                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 0 }}
                            onClick={() => navigate({ to: '/ai/activity' })}
                        >
                            Full activity →
                        </Button>
                    </Stack>
                    <Box>
                        {recentFeed.length === 0 ? (
                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#555' }}>No activity yet.</Typography>
                            </Box>
                        ) : recentFeed.map((event) => (
                            <Stack
                                key={event.key}
                                direction="row"
                                alignItems="center"
                                spacing={2}
                                sx={{
                                    px: 2,
                                    py: 1.1,
                                    borderBottom: '1px solid #1a1a1a',
                                    '&:last-child': { borderBottom: 'none' },
                                }}
                            >
                                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: toneColor(event.tone), flexShrink: 0 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {event.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#444' }}>
                                        {event.label} • {formatRelativeTime(event.createdAt, now)}
                                    </Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Box>
                </Box>
            </Box>
        </AIWorkspacePage>
    );
}
