import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ClearIcon from '@mui/icons-material/Clear';
import { AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const STALE_TASK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

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

type CategoryTab = 'all' | 'approval' | 'failed_run' | 'stale_task' | 'blocked_task' | 'runtime_error';

const TONE_COLOR: Record<InboxRow['tone'], string> = {
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const CATEGORY_TABS: { value: CategoryTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'approval', label: 'Approvals' },
    { value: 'failed_run', label: 'Failed Runs' },
    { value: 'stale_task', label: 'Stale Work' },
    { value: 'blocked_task', label: 'Blocked' },
    { value: 'runtime_error', label: 'Runtime Errors' },
];

export function AIInboxPage() {
    const {
        aiAgentRuntimes,
        aiAgents,
        aiApprovals,
        aiRuns,
        aiTasks,
        aiWakeupRequests,
    } = useAIWorkspaceData();

    const [timeTab, setTimeTab] = useState<'new' | 'all'>('new');
    const [category, setCategory] = useState<CategoryTab>('all');
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const now = Date.now();

    const pendingApprovals = useMemo(
        () => aiApprovals.filter((a) => a.status === 'pending').sort((l, r) => Number(r.createdAt - l.createdAt)),
        [aiApprovals]
    );
    const failedRuns = useMemo(
        () => aiRuns.filter((r) => r.status === 'failed').sort((l, r) => Number(r.updatedAt - l.updatedAt)),
        [aiRuns]
    );
    const staleTasks = useMemo(
        () => aiTasks.filter((t) => !['completed', 'cancelled', 'failed'].includes(t.status) && Number(t.updatedAt) < now - STALE_TASK_WINDOW_MS),
        [aiTasks, now]
    );
    const blockedTasks = useMemo(() => aiTasks.filter((t) => t.status === 'blocked'), [aiTasks]);
    const failedWakeups = useMemo(() => aiWakeupRequests.filter((w) => w.status === 'failed'), [aiWakeupRequests]);
    const runtimeErrors = useMemo(() => aiAgentRuntimes.filter((r) => r.runtimeStatus === 'error'), [aiAgentRuntimes]);

    const inboxRows = useMemo(() => {
        const rows: InboxRow[] = [];

        pendingApprovals.forEach((approval) => {
            const task = aiTasks.find((t) => t.id === approval.taskId) ?? null;
            const agent = aiAgents.find((a) => a.id === approval.agentId) ?? null;
            rows.push({
                key: `approval-${approval.id.toString()}`,
                bucket: 'approval',
                title: approval.title,
                summary: task?.title || 'Waiting on a linked task',
                detail: `${agent?.name || 'Unknown agent'} • ${formatRelativeTime(approval.createdAt, now)}`,
                tone: approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 'danger' : 'warning',
                href: `/ai/approvals/${approval.id.toString()}`,
                hrefLabel: 'Review',
                rank: approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 0 : 1,
                createdAt: approval.createdAt,
            });
        });

        failedRuns.forEach((run) => {
            const task = aiTasks.find((t) => t.id === run.taskId) ?? null;
            const agent = aiAgents.find((a) => a.id === run.agentId) ?? null;
            const hasTask = run.taskId !== NONE_U64 && task != null;
            rows.push({
                key: `run-${run.id.toString()}`,
                bucket: 'failed_run',
                title: task?.title || 'Failed run',
                summary: run.errorMessage || run.summary || 'Needs operator review before retry.',
                detail: `${agent?.name || 'Unknown agent'} • ${formatRelativeTime(run.updatedAt, now)}`,
                tone: 'danger',
                href: hasTask ? `/ai/tasks/${run.taskId.toString()}` : `/ai/agents/${run.agentId.toString()}`,
                hrefLabel: hasTask ? 'Open task' : 'Open agent',
                rank: 0,
                createdAt: run.updatedAt,
            });
        });

        failedWakeups.forEach((wakeup) => {
            const task = aiTasks.find((t) => t.id === wakeup.taskId) ?? null;
            const agent = aiAgents.find((a) => a.id === wakeup.agentId) ?? null;
            rows.push({
                key: `wakeup-${wakeup.id.toString()}`,
                bucket: 'failed_wakeup',
                title: task?.title || `Wakeup ${wakeup.id.toString()} failed`,
                summary: wakeup.errorMessage || wakeup.reason || 'A queued wakeup failed.',
                detail: `${agent?.name || 'Unknown agent'} • ${formatRelativeTime(wakeup.updatedAt, now)}`,
                tone: 'danger',
                href: task ? `/ai/tasks/${task.id.toString()}` : `/ai/agents/${wakeup.agentId.toString()}`,
                hrefLabel: task ? 'Open task' : 'Open agent',
                rank: 1,
                createdAt: wakeup.updatedAt,
            });
        });

        runtimeErrors.forEach((runtime) => {
            const agent = aiAgents.find((a) => a.id === runtime.agentId) ?? null;
            rows.push({
                key: `runtime-${runtime.agentId.toString()}`,
                bucket: 'runtime_error',
                title: agent?.name || `Agent ${runtime.agentId.toString()}`,
                summary: runtime.lastError || 'Runtime is in error state and needs operator review.',
                detail: `${runtime.adapterType} runtime • ${formatRelativeTime(runtime.updatedAt, now)}`,
                tone: 'danger',
                href: `/ai/agents/${runtime.agentId.toString()}`,
                hrefLabel: 'Open agent',
                rank: 1,
                createdAt: runtime.updatedAt,
            });
        });

        staleTasks.forEach((task) => {
            const agent = aiAgents.find((a) => a.id === task.agentId) ?? null;
            rows.push({
                key: `stale-${task.id.toString()}`,
                bucket: 'stale_task',
                title: task.title,
                summary: task.description || 'Has not moved in over three days.',
                detail: `${agent?.name || 'No agent assigned'} • last updated ${formatBigIntDateTime(task.updatedAt)}`,
                tone: 'warning',
                href: `/ai/tasks/${task.id.toString()}`,
                hrefLabel: 'Open task',
                rank: 2,
                createdAt: task.updatedAt,
            });
        });

        blockedTasks.forEach((task) => {
            const agent = aiAgents.find((a) => a.id === task.agentId) ?? null;
            rows.push({
                key: `blocked-${task.id.toString()}`,
                bucket: 'blocked_task',
                title: task.title,
                summary: task.description || 'Blocked and needs intervention.',
                detail: `${agent?.name || 'No agent assigned'} • ${formatRelativeTime(task.updatedAt, now)}`,
                tone: 'info',
                href: `/ai/tasks/${task.id.toString()}`,
                hrefLabel: 'Open task',
                rank: 3,
                createdAt: task.updatedAt,
            });
        });

        return rows.sort((l, r) => l.rank !== r.rank ? l.rank - r.rank : Number(r.createdAt - l.createdAt));
    }, [aiAgentRuntimes, aiAgents, aiTasks, aiWakeupRequests, failedRuns, failedWakeups, now, pendingApprovals, runtimeErrors, staleTasks, blockedTasks]);

    const visibleRows = useMemo(() => {
        let rows = inboxRows.filter((r) => !dismissed.has(r.key));
        if (timeTab === 'new') {
            const cutoff = BigInt(Math.floor((Date.now() - NEW_WINDOW_MS) * 1000));
            rows = rows.filter((r) => r.createdAt >= cutoff);
        }
        if (category !== 'all') {
            if (category === 'runtime_error') {
                rows = rows.filter((r) => r.bucket === 'runtime_error' || r.bucket === 'failed_wakeup');
            } else {
                rows = rows.filter((r) => r.bucket === category);
            }
        }
        return rows;
    }, [category, dismissed, inboxRows, timeTab]);

    const undismissed = useMemo(() => inboxRows.filter((r) => !dismissed.has(r.key)), [inboxRows, dismissed]);
    const categoryCounts = useMemo(() => ({
        all: undismissed.length,
        approval: undismissed.filter((r) => r.bucket === 'approval').length,
        failed_run: undismissed.filter((r) => r.bucket === 'failed_run').length,
        stale_task: undismissed.filter((r) => r.bucket === 'stale_task').length,
        blocked_task: undismissed.filter((r) => r.bucket === 'blocked_task').length,
        runtime_error: undismissed.filter((r) => r.bucket === 'runtime_error' || r.bucket === 'failed_wakeup').length,
    }), [undismissed]);

    return (
        <AIWorkspacePage page="inbox">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Inbox
                </Typography>
                <Stack direction="row" spacing={1}>
                    <button
                        onClick={() => setTimeTab('new')}
                        style={{
                            padding: '4px 10px',
                            border: '1px solid',
                            borderColor: timeTab === 'new' ? '#fff' : '#1a1a1a',
                            borderRadius: 4,
                            background: 'none',
                            cursor: 'pointer',
                            color: timeTab === 'new' ? '#fff' : '#555',
                            fontSize: '0.75rem',
                        }}
                    >
                        New (48h)
                    </button>
                    <button
                        onClick={() => setTimeTab('all')}
                        style={{
                            padding: '4px 10px',
                            border: '1px solid',
                            borderColor: timeTab === 'all' ? '#fff' : '#1a1a1a',
                            borderRadius: 4,
                            background: 'none',
                            cursor: 'pointer',
                            color: timeTab === 'all' ? '#fff' : '#555',
                            fontSize: '0.75rem',
                        }}
                    >
                        All time
                    </button>
                </Stack>
            </Stack>

            {/* Category tabs */}
            <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid #1a1a1a', mt: -0.5, overflowX: 'auto' }}>
                {CATEGORY_TABS.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => setCategory(t.value)}
                        style={{
                            padding: '6px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: category === t.value ? '#ffffff' : '#555',
                            borderBottom: category === t.value ? '2px solid #ffffff' : '2px solid transparent',
                            fontSize: '0.8rem',
                            fontWeight: category === t.value ? 600 : 400,
                            transition: 'color 0.15s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {t.label}
                        {categoryCounts[t.value] > 0 && (
                            <span style={{ marginLeft: 5, fontSize: '0.7rem', color: category === t.value ? '#858585' : '#444' }}>
                                {categoryCounts[t.value]}
                            </span>
                        )}
                    </button>
                ))}
            </Stack>

            {/* Count */}
            {visibleRows.length > 0 && (
                <Typography variant="caption" sx={{ color: '#555' }}>
                    {visibleRows.length} item{visibleRows.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* List */}
            {visibleRows.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        {undismissed.length === 0 ? 'Inbox is clear.' : 'No items match this filter.'}
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={1}>
                    {visibleRows.slice(0, 25).map((row) => (
                        <Stack
                            key={row.key}
                            direction="row"
                            alignItems="flex-start"
                            spacing={2}
                            sx={{
                                px: 2,
                                py: 1.5,
                                border: '1px solid #1a1a1a',
                                borderLeft: `3px solid ${TONE_COLOR[row.tone]}`,
                                borderRadius: 1,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                    {row.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585', display: 'block', mt: 0.25 }}>
                                    {row.summary}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#555', display: 'block', mt: 0.15 }}>
                                    {row.detail}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                <Button
                                    component="a"
                                    href={row.href}
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                >
                                    {row.hrefLabel} →
                                </Button>
                                <IconButton
                                    size="small"
                                    onClick={() => setDismissed((prev) => new Set([...prev, row.key]))}
                                    sx={{ color: '#333', '&:hover': { color: '#555' } }}
                                >
                                    <ClearIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Stack>
                        </Stack>
                    ))}
                    {visibleRows.length > 25 && (
                        <Typography variant="caption" sx={{ color: '#555', textAlign: 'center', py: 1 }}>
                            {visibleRows.length - 25} more items not shown
                        </Typography>
                    )}
                </Stack>
            )}
        </AIWorkspacePage>
    );
}

export const AiInboxPage = AIInboxPage;
