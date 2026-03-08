import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const STALE_TASK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type InboxRow = {
    key: string;
    bucket: 'approval' | 'failed_run' | 'failed_wakeup' | 'runtime_error' | 'stale_task' | 'blocked_task';
    title: string;
    summary: string;
    detail: string;
    tone: 'danger' | 'warning' | 'info';
    href: string;
    hrefLabel: string;
    rank: number;
    createdAt: bigint;
};

export function AIInboxPage() {
    const {
        aiAgentRuntimes,
        aiAgents,
        aiApprovals,
        aiRuns,
        aiTasks,
        aiWakeupRequests,
    } = useAIWorkspaceData();

    const now = Date.now();
    const pendingApprovals = useMemo(
        () => aiApprovals
            .filter((approval) => approval.status === 'pending')
            .sort((left, right) => Number(right.createdAt - left.createdAt)),
        [aiApprovals]
    );

    const waitingTasks = useMemo(
        () => aiTasks.filter((task) => task.status === 'waiting_approval'),
        [aiTasks]
    );

    const failedRuns = useMemo(
        () => aiRuns
            .filter((run) => run.status === 'failed')
            .sort((left, right) => Number(right.updatedAt - left.updatedAt)),
        [aiRuns]
    );

    const staleTasks = useMemo(
        () => aiTasks
            .filter((task) => (
                !['completed', 'cancelled', 'failed'].includes(task.status) &&
                Number(task.updatedAt) < now - STALE_TASK_WINDOW_MS
            ))
            .sort((left, right) => Number(left.updatedAt - right.updatedAt)),
        [aiTasks, now]
    );

    const blockedTasks = useMemo(
        () => aiTasks
            .filter((task) => task.status === 'blocked')
            .sort((left, right) => Number(right.updatedAt - left.updatedAt)),
        [aiTasks]
    );
    const failedWakeups = useMemo(
        () => aiWakeupRequests
            .filter((wakeup) => wakeup.status === 'failed')
            .sort((left, right) => Number(right.updatedAt - left.updatedAt)),
        [aiWakeupRequests]
    );
    const runtimeErrors = useMemo(
        () => aiAgentRuntimes
            .filter((runtime) => runtime.runtimeStatus === 'error')
            .sort((left, right) => Number(right.updatedAt - left.updatedAt)),
        [aiAgentRuntimes]
    );

    const inboxRows = useMemo(() => {
        const rows: InboxRow[] = [];

        pendingApprovals.forEach((approval) => {
            const task = aiTasks.find((item) => item.id === approval.taskId) ?? null;
            const agent = aiAgents.find((item) => item.id === approval.agentId) ?? null;
            rows.push({
                key: `approval-${approval.id.toString()}`,
                bucket: 'approval',
                title: approval.title,
                summary: task?.title || 'Approval is waiting on a linked task',
                detail: `${agent?.name || 'Unassigned agent'} • ${formatRelativeTime(approval.createdAt, now)}`,
                tone: approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 'danger' : 'warning',
                href: `/ai/approvals/${approval.id.toString()}`,
                hrefLabel: 'Review approval',
                rank: approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 0 : 1,
                createdAt: approval.createdAt,
            });
        });

        failedRuns.forEach((run) => {
            const task = aiTasks.find((item) => item.id === run.taskId) ?? null;
            const agent = aiAgents.find((item) => item.id === run.agentId) ?? null;
            const hasTask = run.taskId !== NONE_U64 && task != null;
            rows.push({
                key: `run-${run.id.toString()}`,
                bucket: 'failed_run',
                title: task?.title || 'Run failed without a linked task title',
                summary: run.errorMessage || run.summary || 'This run needs operator review before it is retried.',
                detail: `${agent?.name || 'Unknown agent'} • ${formatRelativeTime(run.updatedAt, now)}`,
                tone: 'danger',
                href: hasTask ? `/ai/tasks/${run.taskId.toString()}` : `/ai/agents/${run.agentId.toString()}`,
                hrefLabel: hasTask ? 'Open task' : 'Open agent',
                rank: 0,
                createdAt: run.updatedAt,
            });
        });

        failedWakeups.forEach((wakeup) => {
            const task = aiTasks.find((item) => item.id === wakeup.taskId) ?? null;
            const agent = aiAgents.find((item) => item.id === wakeup.agentId) ?? null;
            rows.push({
                key: `wakeup-${wakeup.id.toString()}`,
                bucket: 'failed_wakeup',
                title: task?.title || `Wakeup ${wakeup.id.toString()} failed`,
                summary: wakeup.errorMessage || wakeup.reason || 'A queued wakeup failed before the run could start.',
                detail: `${agent?.name || 'Unknown agent'} • ${formatRelativeTime(wakeup.updatedAt, now)}`,
                tone: 'danger',
                href: task ? `/ai/tasks/${task.id.toString()}` : `/ai/agents/${wakeup.agentId.toString()}`,
                hrefLabel: task ? 'Open task' : 'Open agent',
                rank: 1,
                createdAt: wakeup.updatedAt,
            });
        });

        runtimeErrors.forEach((runtime) => {
            const agent = aiAgents.find((item) => item.id === runtime.agentId) ?? null;
            rows.push({
                key: `runtime-${runtime.agentId.toString()}`,
                bucket: 'runtime_error',
                title: agent?.name || `Agent ${runtime.agentId.toString()}`,
                summary: runtime.lastError || 'The runtime is reporting an error state and needs operator review.',
                detail: `${runtime.adapterType} runtime • ${formatRelativeTime(runtime.updatedAt, now)}`,
                tone: 'danger',
                href: `/ai/agents/${runtime.agentId.toString()}`,
                hrefLabel: 'Open agent',
                rank: 1,
                createdAt: runtime.updatedAt,
            });
        });

        staleTasks.forEach((task) => {
            const agent = aiAgents.find((item) => item.id === task.agentId) ?? null;
            rows.push({
                key: `stale-${task.id.toString()}`,
                bucket: 'stale_task',
                title: task.title,
                summary: task.description || 'This task has not moved in over three days.',
                detail: `${agent?.name || 'No agent assigned'} • last updated ${formatBigIntDateTime(task.updatedAt)}`,
                tone: 'warning',
                href: `/ai/tasks/${task.id.toString()}`,
                hrefLabel: 'Open task',
                rank: 2,
                createdAt: task.updatedAt,
            });
        });

        blockedTasks.forEach((task) => {
            const agent = aiAgents.find((item) => item.id === task.agentId) ?? null;
            rows.push({
                key: `blocked-${task.id.toString()}`,
                bucket: 'blocked_task',
                title: task.title,
                summary: task.description || 'This task is blocked and needs intervention.',
                detail: `${agent?.name || 'No agent assigned'} • ${formatRelativeTime(task.updatedAt, now)}`,
                tone: 'info',
                href: `/ai/tasks/${task.id.toString()}`,
                hrefLabel: 'Unblock task',
                rank: 3,
                createdAt: task.updatedAt,
            });
        });

        return rows.sort((left, right) => {
            if (left.rank !== right.rank) {
                return left.rank - right.rank;
            }
            return Number(right.createdAt - left.createdAt);
        });
    }, [aiAgentRuntimes, aiAgents, aiTasks, aiWakeupRequests, aiRuns, blockedTasks, failedRuns, failedWakeups, now, pendingApprovals, runtimeErrors, staleTasks]);

    const visibleRows = useMemo(() => {
        const baseRows = tab === 'new'
            ? inboxRows.filter((row) => row.bucket !== 'blocked_task')
            : inboxRows;

        if (tab === 'all' && category !== 'everything') {
            return baseRows.filter((row) => row.bucket === category);
        }

        return baseRows;
    }, [category, inboxRows, tab]);

    return (
        <AIWorkspacePage page="inbox">
            <AIPageIntro
                eyebrow="Inbox"
                title="Work that needs a human now"
                description="This is the operator queue for approvals, failed runs, stale tasks, and blocked work. Use it to triage the items that need human intervention before the autonomous layer grows."
                actionSlot={
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            component={Link}
                            to="/ai/tasks"
                            sx={{ textTransform: 'none' }}
                        >
                            Open tasks
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            component={Link}
                            to="/ai/approvals"
                            sx={{ textTransform: 'none' }}
                        >
                            Review approvals
                        </Button>
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Needs attention" value={String(inboxRows.length)} caption="Combined queue across approvals, runs, and tasks" tone="warning" />
                <AIStatCard label="Pending approvals" value={String(pendingApprovals.length)} caption={`${waitingTasks.length} tasks are waiting for review`} tone="danger" />
                <AIStatCard label="Failed runs" value={String(failedRuns.length)} caption="Execution attempts that need retry or diagnosis" tone="info" />
                <AIStatCard label="Runtime faults" value={String(runtimeErrors.length + failedWakeups.length)} caption="Runtime errors and wakeup failures" tone="danger" />
                <AIStatCard label="Stale tasks" value={String(staleTasks.length)} caption="Open work that has not moved in over three days" tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard
                    eyebrow="Queue"
                    title="Action queue"
                    description="Sorted from the most urgent items down: risky approvals first, then failed runs, stale tasks, and blocked work."
                    actionSlot={(
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1}>
                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    variant={tab === 'new' ? 'contained' : 'outlined'}
                                    onClick={() => setTab('new')}
                                    sx={{ textTransform: 'none', minWidth: 82 }}
                                >
                                    New
                                </Button>
                                <Button
                                    size="small"
                                    variant={tab === 'all' ? 'contained' : 'outlined'}
                                    onClick={() => setTab('all')}
                                    sx={{ textTransform: 'none', minWidth: 82 }}
                                >
                                    All
                                </Button>
                            </Stack>
                            {tab === 'all' ? (
                                <TextField
                                    select
                                    size="small"
                                    label="Category"
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value as typeof category)}
                                    sx={{ minWidth: 180 }}
                                >
                                    <MenuItem value="everything">Everything</MenuItem>
                                    <MenuItem value="approval">Approvals</MenuItem>
                                    <MenuItem value="failed_run">Failed runs</MenuItem>
                                    <MenuItem value="failed_wakeup">Wakeup failures</MenuItem>
                                    <MenuItem value="runtime_error">Runtime faults</MenuItem>
                                    <MenuItem value="stale_task">Stale work</MenuItem>
                                    <MenuItem value="blocked_task">Blocked tasks</MenuItem>
                                </TextField>
                            ) : null}
                        </Stack>
                    )}
                >
                    <Stack spacing={1.2}>
                        {visibleRows.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                Nothing matches the current inbox view. The queue is clear for this filter.
                            </Typography>
                        ) : visibleRows.slice(0, 10).map((row) => (
                            <Stack
                                key={row.key}
                                spacing={1}
                                sx={{
                                    px: 1.6,
                                    py: 1.4,
                                    borderRadius: '14px',
                                    border: '1px solid #1a1a1a',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                                    <Stack spacing={0.45}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {row.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                            {row.summary}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            {row.detail}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <AIStatusPill label={row.bucket.replace('_', ' ')} tone={row.tone} />
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            href={row.href}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            {row.hrefLabel}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Buckets"
                    title="What is filling the queue"
                    description="A simple operational read of what kind of intervention the workspace is asking for."
                >
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {pendingApprovals.length} approvals need a human decision before work can continue.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {failedRuns.length} failed runs need diagnosis, retry, or scope adjustment.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {staleTasks.length} stale tasks have not moved recently and likely need reassignment or closure.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            {blockedTasks.length} tasks are blocked outright. These usually point to missing approvals or broken execution paths.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Pressure"
                    title="Queue pressure signals"
                    description="Short operator guidance derived from the current AI records."
                >
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {pendingApprovals.length > 0
                                ? `Start with approvals. ${pendingApprovals.length} tasks are currently waiting on a reviewer.`
                                : 'Approvals are not the current bottleneck.'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {failedRuns.length > 0
                                ? `${failedRuns.length} runs have already failed. Review those before launching more work against the same agents.`
                                : 'No failed runs are waiting for recovery right now.'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Oldest stale task updated {staleTasks[0] ? formatBigIntDateTime(staleTasks[0].updatedAt) : 'not applicable'}.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Routing"
                    title="Next places to go"
                    description="Use the specialized pages once you know which lane needs work."
                >
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="outlined" component={Link} to="/ai/tasks" sx={{ textTransform: 'none' }}>
                            Task board
                        </Button>
                        <Button size="small" variant="outlined" component={Link} to="/ai/approvals" sx={{ textTransform: 'none' }}>
                            Approval queue
                        </Button>
                        <Button size="small" variant="outlined" component={Link} to="/ai/activity" sx={{ textTransform: 'none' }}>
                            Activity feed
                        </Button>
                        <Button size="small" variant="outlined" component={Link} to="/ai/agents" sx={{ textTransform: 'none' }}>
                            Agent roster
                        </Button>
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiInboxPage = AIInboxPage;
    const [tab, setTab] = useState<'new' | 'all'>('new');
    const [category, setCategory] = useState<'everything' | 'approval' | 'failed_run' | 'stale_task' | 'blocked_task'>('everything');
