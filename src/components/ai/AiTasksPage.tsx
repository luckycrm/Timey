import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import AddIcon from '@mui/icons-material/Add';
import AiKanbanBoard from './AiKanbanBoard';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const priorityOptions = ['low', 'normal', 'high', 'urgent'] as const;

type TaskTab = 'all' | 'open' | 'running' | 'blocked' | 'done';

const TABS: { value: TaskTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'running', label: 'Running' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' },
];

export function AITasksPage() {
    const {
        currentOrgId,
        aiAdapterSessions,
        aiTasks,
        aiProjects,
        aiGoals,
        aiAgents,
        aiApprovals,
        aiRuns,
        aiWakeupRequests,
    } = useAIWorkspaceData();

    const createAiTask = useReducer(reducers.createAiTask);
    const updateAiTaskStatus = useReducer(reducers.updateAiTaskStatus);
    const createAiApproval = useReducer(reducers.createAiApproval);
    const createAiRun = useReducer(reducers.createAiRun);
    const updateAiRunStatus = useReducer(reducers.updateAiRunStatus);

    const [form, setForm] = useState({
        title: '',
        description: '',
        projectId: '0',
        goalId: '0',
        agentId: '0',
        priority: 'normal',
        dueAt: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [tab, setTab] = useState<TaskTab>('all');

    const tasksWithContext = useMemo(() => {
        const sorted = [...aiTasks].sort((left, right) => {
            const priorityRank = { urgent: 3, high: 2, normal: 1, low: 0 };
            const priorityDiff = (priorityRank[right.priority as keyof typeof priorityRank] ?? 0)
                - (priorityRank[left.priority as keyof typeof priorityRank] ?? 0);
            if (priorityDiff !== 0) return priorityDiff;
            return Number(left.createdAt - right.createdAt);
        });

        return sorted.map((task) => ({
            task,
            agent: aiAgents.find((agent) => agent.id === task.agentId) ?? null,
            project: aiProjects.find((project) => project.id === task.projectId) ?? null,
            goal: aiGoals.find((goal) => goal.id === task.goalId) ?? null,
            pendingApproval: aiApprovals.find((approval) => approval.taskId === task.id && approval.status === 'pending') ?? null,
            activeRun: [...aiRuns]
                .filter((run) => run.taskId === task.id)
                .sort((left, right) => Number(right.createdAt - left.createdAt))
                .find((run) => run.status === 'running' || run.status === 'waiting_approval') ?? null,
            openWakeups: aiWakeupRequests.filter((wakeup) => wakeup.taskId === task.id && ['queued', 'claimed', 'running'].includes(wakeup.status)),
            activeSessions: aiAdapterSessions.filter((session) => (
                session.status === 'active' &&
                session.runId !== NONE_U64 &&
                aiRuns.some((run) => run.id === session.runId && run.taskId === task.id)
            )),
        }));
    }, [aiAdapterSessions, aiAgents, aiApprovals, aiGoals, aiProjects, aiRuns, aiTasks, aiWakeupRequests]);

    const filteredTasks = useMemo(() => {
        return tasksWithContext.filter(({ task }) => {
            if (tab === 'open') return !['completed', 'cancelled', 'failed'].includes(task.status);
            if (tab === 'running') return task.status === 'running';
            if (tab === 'blocked') return task.status === 'blocked' || task.status === 'failed' || task.status === 'waiting_approval';
            if (tab === 'done') return task.status === 'completed' || task.status === 'cancelled';
            return true;
        });
    }, [tasksWithContext, tab]);

    const tabCount = (t: TaskTab) => {
        if (t === 'all') return aiTasks.length;
        if (t === 'open') return aiTasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.status)).length;
        if (t === 'running') return aiTasks.filter((task) => task.status === 'running').length;
        if (t === 'blocked') return aiTasks.filter((task) => ['blocked', 'failed', 'waiting_approval'].includes(task.status)).length;
        if (t === 'done') return aiTasks.filter((task) => ['completed', 'cancelled'].includes(task.status)).length;
        return 0;
    };

    const handleCreateTask = async (event: React.FormEvent) => {
        event.preventDefault();
        if (currentOrgId == null) return;

        try {
            setSubmitting(true);
            await createAiTask({
                orgId: currentOrgId,
                projectId: BigInt(form.projectId),
                goalId: BigInt(form.goalId),
                agentId: BigInt(form.agentId),
                title: form.title.trim(),
                description: form.description.trim(),
                priority: form.priority,
                sourceType: 'manual',
                linkedEntityType: '',
                linkedEntityId: 0n,
                dueAt: form.dueAt ? BigInt(new Date(form.dueAt).getTime()) : 0n,
            });
            setForm({
                title: '',
                description: '',
                projectId: form.projectId,
                goalId: '0',
                agentId: '0',
                priority: 'normal',
                dueAt: '',
            });
            toast.success('Task created');
            setCreateOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create task');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestApproval = async (taskId: bigint, agentId: bigint, title: string) => {
        if (currentOrgId == null) return;
        try {
            await createAiApproval({
                orgId: currentOrgId,
                taskId,
                agentId: agentId === NONE_U64 ? 0n : agentId,
                title: `Review ${title}`,
                summary: `Approve or reject the next action for "${title}".`,
                riskLevel: 'medium',
                actionType: 'task_release',
                metadataJson: '{}',
            });
            toast.success('Approval requested');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to request approval');
        }
    };

    const handleStartTask = async (taskId: bigint, agentId: bigint) => {
        if (currentOrgId == null) return;
        try {
            await updateAiTaskStatus({ taskId, status: 'running' });
            try {
                await createAiRun({
                    orgId: currentOrgId,
                    taskId,
                    agentId: agentId === NONE_U64 ? 0n : agentId,
                    status: 'running',
                    triggerType: 'manual',
                    summary: 'Started from task board',
                    errorMessage: '',
                    tokenInput: 0n,
                    tokenOutput: 0n,
                    toolCalls: 0n,
                    costMicrousd: 0n,
                });
            } catch (error) {
                await updateAiTaskStatus({ taskId, status: 'queued' }).catch(() => {});
                throw error;
            }
            toast.success('Task started');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start task');
        }
    };

    const handleCompleteTask = async (taskId: bigint, activeRunId: bigint | null) => {
        try {
            await updateAiTaskStatus({ taskId, status: 'completed' });
            if (activeRunId != null) {
                try {
                    await updateAiRunStatus({
                        runId: activeRunId,
                        status: 'completed',
                        summary: 'Completed from task board',
                        errorMessage: '',
                        tokenInput: 0n,
                        tokenOutput: 0n,
                        toolCalls: 0n,
                        costMicrousd: 0n,
                    });
                } catch (error) {
                    await updateAiTaskStatus({ taskId, status: 'running' }).catch(() => {});
                    throw error;
                }
            }
            toast.success('Task completed');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to complete task');
        }
    };

    const priorityColor = (p: string) =>
        p === 'urgent' ? '#e33d4f' : p === 'high' ? '#ff9800' : '#555';

    const statusColor = (s: string) =>
        s === 'running' ? '#38c872' :
        s === 'waiting_approval' || s === 'blocked' || s === 'failed' ? '#ff9800' :
        s === 'completed' ? '#555' : '#444';

    return (
        <AIWorkspacePage page="tasks">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Tasks
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, next) => { if (next) setViewMode(next); }}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                color: '#444',
                                borderColor: '#1a1a1a',
                                textTransform: 'none',
                                px: 1.2,
                                py: 0.5,
                                fontSize: '0.75rem',
                                '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                            },
                        }}
                    >
                        <ToggleButton value="list" aria-label="List view">
                            <ViewListIcon sx={{ fontSize: 15, mr: 0.5 }} />
                            List
                        </ToggleButton>
                        <ToggleButton value="kanban" aria-label="Kanban view">
                            <ViewKanbanIcon sx={{ fontSize: 15, mr: 0.5 }} />
                            Kanban
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setCreateOpen(true)}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            borderColor: '#1a1a1a',
                            color: '#858585',
                            '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' },
                        }}
                    >
                        New Task
                    </Button>
                </Stack>
            </Stack>

            {viewMode === 'kanban' ? (
                <Box sx={{ mt: 0.5 }}>
                    <AiKanbanBoard
                        tasks={aiTasks}
                        onTaskClick={(id) => { window.location.href = `/ai/tasks/${id.toString()}`; }}
                        agentNames={new Map(aiAgents.map((a) => [a.id, a.name]))}
                    />
                </Box>
            ) : (
                <>
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
                                    <span style={{ marginLeft: 5, fontSize: '0.7rem', color: tab === t.value ? '#858585' : '#444' }}>
                                        {tabCount(t.value)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </Stack>

                    {/* Count */}
                    {filteredTasks.length > 0 && (
                        <Typography variant="caption" sx={{ color: '#555' }}>
                            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                        </Typography>
                    )}

                    {/* Task list */}
                    {aiTasks.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#555' }}>No tasks yet.</Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 2, textTransform: 'none', borderColor: '#1a1a1a', color: '#858585', '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' } }}
                                onClick={() => setCreateOpen(true)}
                            >
                                Create your first task
                            </Button>
                        </Box>
                    ) : filteredTasks.length === 0 ? (
                        <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#555' }}>No tasks match this filter.</Typography>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                            {filteredTasks.map(({ task, agent, project, goal, pendingApproval, activeRun }) => (
                                <Stack
                                    key={task.id.toString()}
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
                                            bgcolor: statusColor(task.status),
                                            flexShrink: 0,
                                        }}
                                    />

                                    {/* Name + meta */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {task.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#555' }}>
                                            {project?.name || 'No project'}
                                            {goal ? ` • ${goal.title}` : ''}
                                            {agent ? ` • ${agent.name}` : ''}
                                            {task.dueAt && task.dueAt > 0n ? ` • due ${formatRelativeTime(task.dueAt)}` : ''}
                                        </Typography>
                                    </Box>

                                    {/* Right */}
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                                        <Chip
                                            size="small"
                                            label={task.priority}
                                            sx={{
                                                fontSize: '0.7rem',
                                                height: 20,
                                                bgcolor: 'transparent',
                                                color: priorityColor(task.priority),
                                                border: '1px solid #1a1a1a',
                                                borderRadius: '4px',
                                            }}
                                        />
                                        <Chip
                                            size="small"
                                            label={task.status.replace(/_/g, ' ')}
                                            sx={{
                                                fontSize: '0.7rem',
                                                height: 20,
                                                bgcolor: 'transparent',
                                                color: '#555',
                                                border: '1px solid #1a1a1a',
                                                borderRadius: '4px',
                                            }}
                                        />
                                        {task.status === 'queued' && (
                                            <Button
                                                size="small"
                                                variant="text"
                                                sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                                onClick={() => handleStartTask(task.id, task.agentId)}
                                            >
                                                Start
                                            </Button>
                                        )}
                                        {task.status === 'running' && (
                                            <Button
                                                size="small"
                                                variant="text"
                                                sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                                onClick={() => handleCompleteTask(task.id, activeRun?.id ?? null)}
                                            >
                                                Complete
                                            </Button>
                                        )}
                                        {!pendingApproval && !['waiting_approval', 'completed', 'cancelled'].includes(task.status) && (
                                            <Button
                                                size="small"
                                                variant="text"
                                                sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                                onClick={() => handleRequestApproval(task.id, task.agentId, task.title)}
                                            >
                                                Approve?
                                            </Button>
                                        )}
                                        <Button
                                            component="a"
                                            href={`/ai/tasks/${task.id.toString()}`}
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                        >
                                            Details →
                                        </Button>
                                    </Stack>
                                </Stack>
                            ))}
                        </Box>
                    )}
                </>
            )}

            {/* Create Task Dialog */}
            <Dialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                        New Task
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack component="form" spacing={1.4} id="create-task-form" onSubmit={handleCreateTask}>
                        <TextField
                            size="small"
                            label="Task title"
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Draft proposal for Northwind renewal"
                            autoFocus
                        />
                        <TextField
                            size="small"
                            label="Description"
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            multiline
                            minRows={3}
                            placeholder="Summarize the renewal scope, key objections, and the draft send package."
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Project"
                                value={form.projectId}
                                onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                <MenuItem value="0">No project</MenuItem>
                                {aiProjects.map((project) => (
                                    <MenuItem key={project.id.toString()} value={project.id.toString()}>
                                        {project.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Goal"
                                value={form.goalId}
                                onChange={(event) => setForm((current) => ({ ...current, goalId: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                <MenuItem value="0">No goal</MenuItem>
                                {aiGoals.map((goal) => (
                                    <MenuItem key={goal.id.toString()} value={goal.id.toString()}>
                                        {goal.title}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Agent"
                                value={form.agentId}
                                onChange={(event) => setForm((current) => ({ ...current, agentId: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                <MenuItem value="0">Unassigned</MenuItem>
                                {aiAgents.map((agent) => (
                                    <MenuItem key={agent.id.toString()} value={agent.id.toString()}>
                                        {agent.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Priority"
                                value={form.priority}
                                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                {priorityOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Due date"
                                type="datetime-local"
                                value={form.dueAt}
                                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flex: 1 }}
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1a1a1a' }}>
                    <Button
                        variant="text"
                        onClick={() => setCreateOpen(false)}
                        sx={{ textTransform: 'none', color: '#555' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-task-form"
                        variant="contained"
                        disabled={submitting || currentOrgId == null || !form.title.trim()}
                        sx={{ textTransform: 'none' }}
                    >
                        {submitting ? 'Creating...' : 'Create task'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}

export const AiTasksPage = AITasksPage;
