import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from '@tanstack/react-router';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, formatUsd, microusdToUsd } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

function startOfWeek(date: Date) {
    const clone = new Date(date);
    const day = clone.getDay();
    clone.setHours(0, 0, 0, 0);
    clone.setDate(clone.getDate() - day);
    return clone.getTime();
}

function getLastSevenDayKeys(now: number) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        return date.toISOString().slice(0, 10);
    });
}

function dayKeyFromBigInt(value: bigint) {
    return new Date(Number(value)).toISOString().slice(0, 10);
}

function titleCase(value: string) {
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function BarStrip({
    bars,
    emptyLabel,
    tone = '#7eb0ff',
}: {
    bars: Array<{ key: string; label: string; value: number; caption?: string }>;
    emptyLabel: string;
    tone?: string;
}) {
    const maxValue = Math.max(...bars.map((bar) => bar.value), 0);

    if (maxValue === 0) {
        return (
            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                {emptyLabel}
            </Typography>
        );
    }

    return (
        <Stack spacing={1.1}>
            {bars.map((bar) => (
                <Stack key={bar.key} spacing={0.55}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                            {bar.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#858585' }}>
                            {bar.caption ?? bar.value}
                        </Typography>
                    </Stack>
                    <Box
                        sx={{
                            height: 7,
                            borderRadius: '999px',
                            bgcolor: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                width: `${bar.value === 0 ? 0 : (bar.value / maxValue) * 100}%`,
                                height: '100%',
                                borderRadius: '999px',
                                bgcolor: tone,
                            }}
                        />
                    </Box>
                </Stack>
            ))}
        </Stack>
    );
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
    const queuedRuns = aiRuns.filter((run) => run.status === 'queued');
    const openWakeups = aiWakeupRequests.filter((wakeup) => ['queued', 'claimed', 'running'].includes(wakeup.status));
    const runtimeAttachedAgents = aiAgents.filter((agent) => aiAgentRuntimes.some((runtime) => runtime.agentId === agent.id));
    const activeAdapterSessions = aiAdapterSessions.filter((session) => session.status === 'active');
    const weeklySpend = aiRuns
        .filter((run) => Number(run.createdAt) >= weekStart)
        .reduce((total, run) => total + microusdToUsd(run.costMicrousd), 0);

    const runStatusCounts = {
        running: liveRuns.length,
        queued: queuedRuns.length,
        waitingApproval: aiRuns.filter((run) => run.status === 'waiting_approval').length,
        failed: failedRuns.length,
    };

    const priorityCounts = {
        urgent: aiTasks.filter((task) => task.priority === 'urgent').length,
        high: aiTasks.filter((task) => task.priority === 'high').length,
        normal: aiTasks.filter((task) => task.priority === 'normal').length,
        low: aiTasks.filter((task) => task.priority === 'low').length,
    };

    const sevenDaySpendBars = getLastSevenDayKeys(now).map((dayKey) => {
        const dayRuns = aiRuns.filter((run) => dayKeyFromBigInt(run.createdAt) === dayKey);
        const spend = dayRuns.reduce((total, run) => total + microusdToUsd(run.costMicrousd), 0);
        const label = new Date(`${dayKey}T12:00:00`).toLocaleDateString([], { weekday: 'short' });
        return {
            key: dayKey,
            label,
            value: Number(spend.toFixed(2)),
            caption: `${formatUsd(spend)} • ${dayRuns.length} runs`,
        };
    });

    const activeAgentRows = activeAgents
        .map((agent) => {
            const runtime = aiAgentRuntimes.find((row) => row.agentId === agent.id) ?? null;
            const agentRuns = aiRuns.filter((run) => run.agentId === agent.id && ['queued', 'running', 'waiting_approval'].includes(run.status));
            const agentWakeups = aiWakeupRequests.filter((wakeup) => wakeup.agentId === agent.id && ['queued', 'claimed', 'running'].includes(wakeup.status));
            const agentSessions = aiAdapterSessions.filter((session) => session.agentId === agent.id && session.status === 'active');
            const project = aiProjects.find((project) => project.id === agent.projectId) ?? null;
            return {
                agent,
                runtime,
                project,
                runCount: agentRuns.length,
                wakeupCount: agentWakeups.length,
                sessionCount: agentSessions.length,
            };
        })
        .sort((left, right) => (right.runCount + right.wakeupCount + right.sessionCount) - (left.runCount + left.wakeupCount + left.sessionCount))
        .slice(0, 6);

    const actionQueue = [
        {
            id: 'approvals',
            title: 'Clear the approval queue',
            detail: `${pendingApprovals.length} approvals are waiting before work can continue.`,
            buttonLabel: 'Open approvals',
            tone: pendingApprovals.length > 0 ? 'warning' as const : 'success' as const,
            visible: pendingApprovals.length > 0,
            onClick: () => navigate({ to: '/ai/approvals' }),
        },
        {
            id: 'stale',
            title: 'Resolve stale tasks',
            detail: `${staleTasks.length} tasks have not moved in over three days.`,
            buttonLabel: 'Open inbox',
            tone: staleTasks.length > 0 ? 'warning' as const : 'success' as const,
            visible: staleTasks.length > 0,
            onClick: () => navigate({ to: '/ai/inbox' }),
        },
        {
            id: 'blocked',
            title: 'Unblock execution',
            detail: `${blockedTasks.length} tasks are explicitly blocked.`,
            buttonLabel: 'Open tasks',
            tone: blockedTasks.length > 0 ? 'danger' as const : 'success' as const,
            visible: blockedTasks.length > 0,
            onClick: () => navigate({ to: '/ai/tasks' }),
        },
        {
            id: 'failures',
            title: 'Review failed runs',
            detail: `${failedRuns.length} failed runs are sitting in the ledger.`,
            buttonLabel: 'Open activity',
            tone: failedRuns.length > 0 ? 'danger' as const : 'success' as const,
            visible: failedRuns.length > 0,
            onClick: () => navigate({ to: '/ai/activity' }),
        },
    ].filter((item) => item.visible);

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
            return {
                project,
                owner,
                staffedAgents,
                projectTasks,
                avgProgress,
            };
        });

    const recentFeed = [
        ...aiActivities.map((event) => ({
            key: `activity-${event.id.toString()}`,
            createdAt: event.createdAt,
            title: event.description,
            label: titleCase(event.eventType),
            tone: event.eventType.includes('failed') ? 'danger' as const : event.eventType.includes('approval') ? 'warning' as const : 'info' as const,
            supporting: 'Workspace event',
        })),
        ...aiRunEvents.map((event) => ({
            key: `run-event-${event.id.toString()}`,
            createdAt: event.createdAt,
            title: event.message,
            label: titleCase(event.eventType),
            tone: event.level === 'error' ? 'danger' as const : event.level === 'warning' ? 'warning' as const : 'neutral' as const,
            supporting: `Run ${event.runId.toString()}`,
        })),
    ]
        .sort((left, right) => Number(right.createdAt - left.createdAt))
        .slice(0, 8);

    const cleanPassRate = aiTasks.length === 0
        ? 0
        : Math.round((aiTasks.filter((task) => task.status === 'completed').length / aiTasks.length) * 100);
    const approvalResolutionRate = aiApprovals.length === 0
        ? 0
        : Math.round((aiApprovals.filter((approval) => approval.status !== 'pending').length / aiApprovals.length) * 100);
    const staffedProjectRate = aiProjects.length === 0
        ? 0
        : Math.round((aiProjects.filter((project) => aiAgents.some((agent) => agent.projectId === project.id)).length / aiProjects.length) * 100);

    return (
        <AIWorkspacePage page="home">
            <AIPageIntro
                eyebrow="AI Home"
                title="Run the AI workspace like an operator cockpit"
                description="This surface now focuses on the live queue, agent coverage, execution pressure, and budget signals instead of acting like a generic summary page."
                actionSlot={
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button variant="outlined" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/agents' })}>
                            Open agents
                        </Button>
                        <Button variant="outlined" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/tasks' })}>
                            Open tasks
                        </Button>
                        <Button variant="contained" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/inbox' })}>
                            Open inbox
                        </Button>
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Active agents" value={String(activeAgents.length)} caption={`${runtimeAttachedAgents.length} already have runtimes attached`} tone="success" />
                <AIStatCard label="Open tasks" value={String(openTasks.length)} caption={`${blockedTasks.length} blocked • ${staleTasks.length} stale`} tone="info" />
                <AIStatCard label="Approvals waiting" value={String(pendingApprovals.length)} caption={`${aiApprovals.filter((approval) => approval.status !== 'pending').length} already resolved`} tone="warning" />
                <AIStatCard label="Spend this week" value={formatUsd(weeklySpend)} caption={`${liveRuns.length} live runs • ${openWakeups.length} open wakeups • ${activeAdapterSessions.length} active sessions`} tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Queue" title="Operator action queue" description="These are the items most likely to stop progress right now.">
                    <Stack spacing={1.15}>
                        {actionQueue.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No immediate blockers are building up. The queue is clear.
                            </Typography>
                        ) : actionQueue.map((item) => (
                            <Stack
                                key={item.id}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.5,
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '14px',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.55}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#858585' }}>
                                        {item.detail}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <AIStatusPill label={item.tone === 'danger' ? 'Attention' : item.tone === 'warning' ? 'Needs review' : 'Clear'} tone={item.tone} />
                                    <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={item.onClick}>
                                        {item.buttonLabel}
                                    </Button>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Roster" title="Active agents" description="The current live workforce, ranked by runtime pressure and active workload.">
                    <Stack spacing={1.15}>
                        {activeAgentRows.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No active agents are available yet. Activate agents first to build the runtime roster.
                            </Typography>
                        ) : activeAgentRows.map((row) => (
                            <Stack
                                key={row.agent.id.toString()}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.5,
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '14px',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.45}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {row.agent.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {row.agent.role} • {row.project?.name || 'No project'} • {row.runtime?.adapterType || 'No runtime attached'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {row.runCount} live runs • {row.wakeupCount} open wakeups • {row.sessionCount} active sessions
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <AIStatusPill label={row.runtime?.runtimeStatus || row.agent.status} tone={row.runtime?.runtimeStatus === 'error' ? 'danger' : 'info'} />
                                    <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/agents/$agentId', params: { agentId: row.agent.id.toString() } })}>
                                        Open agent
                                    </Button>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Pressure" title="Queue and execution mix" description="A compact read on where volume and risk are concentrating.">
                    <Stack spacing={1.6}>
                        <AIProgressRow label="Tasks completed cleanly" value={cleanPassRate} detail={`${aiTasks.filter((task) => task.status === 'completed').length} completed`} tone="success" />
                        <AIProgressRow label="Approvals resolved" value={approvalResolutionRate} detail={`${aiApprovals.filter((approval) => approval.status !== 'pending').length} decisions`} tone="warning" />
                        <AIProgressRow label="Projects staffed" value={staffedProjectRate} detail={`${aiProjects.filter((project) => aiAgents.some((agent) => agent.projectId === project.id)).length} staffed`} tone="info" />
                        <BarStrip
                            bars={[
                                { key: 'running', label: 'Running', value: runStatusCounts.running },
                                { key: 'queued', label: 'Queued', value: runStatusCounts.queued },
                                { key: 'waiting', label: 'Waiting approval', value: runStatusCounts.waitingApproval },
                                { key: 'failed', label: 'Failed', value: runStatusCounts.failed },
                            ]}
                            emptyLabel="No runs are recorded yet."
                            tone="#7eb0ff"
                        />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Priority" title="Task urgency and spend trend" description="This is the quickest way to see whether work mix and spend are drifting in the wrong direction.">
                    <Stack spacing={1.6}>
                        <BarStrip
                            bars={[
                                { key: 'urgent', label: 'Urgent tasks', value: priorityCounts.urgent },
                                { key: 'high', label: 'High priority', value: priorityCounts.high },
                                { key: 'normal', label: 'Normal priority', value: priorityCounts.normal },
                                { key: 'low', label: 'Low priority', value: priorityCounts.low },
                            ]}
                            emptyLabel="No tasks are recorded yet."
                            tone="#ff9800"
                        />
                        <BarStrip
                            bars={sevenDaySpendBars}
                            emptyLabel="No run spend has been recorded in the last seven days."
                            tone="#38c872"
                        />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Projects" title="Portfolio snapshot" description="A compact view of the newest workstreams, with staffing and progress in one place.">
                    <Stack spacing={1.15}>
                        {portfolioRows.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No AI projects exist yet. Create the first project to start structuring the portfolio.
                            </Typography>
                        ) : portfolioRows.map((row) => (
                            <Stack
                                key={row.project.id.toString()}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.5,
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '14px',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.45}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {row.project.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        Owner {row.owner?.name || row.owner?.email || 'Unknown'} • {row.staffedAgents.length} agents • {row.projectTasks.length} tasks
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#666666' }}>
                                        Avg goal progress {row.avgProgress}% • Updated {formatRelativeTime(row.project.updatedAt, now)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <AIStatusPill label={row.project.status} tone={row.project.status === 'watching' ? 'warning' : row.project.status === 'active' ? 'success' : 'neutral'} />
                                    <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/projects/$projectId', params: { projectId: row.project.id.toString() } })}>
                                        Open project
                                    </Button>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Feed" title="Recent control-plane activity" description="A single feed mixing workspace events and detailed run events so the operator can scan what changed."
                    actionSlot={
                        <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => navigate({ to: '/ai/activity' })}>
                            Open full activity
                        </Button>
                    }
                >
                    <Stack spacing={1.15}>
                        {recentFeed.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No AI activity has been recorded yet.
                            </Typography>
                        ) : recentFeed.map((event) => (
                            <Stack
                                key={event.key}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.35,
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '14px',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.45}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {event.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {event.supporting} • {formatRelativeTime(event.createdAt, now)}
                                    </Typography>
                                </Stack>
                                <AIStatusPill label={event.label} tone={event.tone} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}
