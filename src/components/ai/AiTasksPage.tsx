import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const priorityOptions = ['low', 'normal', 'high', 'urgent'] as const;

export function AITasksPage() {
    const {
        currentOrgId,
        aiAdapterSessions,
        aiTasks,
        aiProjects,
        aiGoals,
        aiAgents,
        aiApprovals,
        aiRunEvents,
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
            runEvents: aiRunEvents.filter((event) => event.taskId === task.id),
            activeSessions: aiAdapterSessions.filter((session) => (
                session.status === 'active' &&
                session.runId !== NONE_U64 &&
                aiRuns.some((run) => run.id === session.runId && run.taskId === task.id)
            )),
        }));
    }, [aiAdapterSessions, aiAgents, aiApprovals, aiGoals, aiProjects, aiRunEvents, aiRuns, aiTasks, aiWakeupRequests]);

    const openTasks = aiTasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.status));
    const inMotion = aiTasks.filter((task) => task.status === 'running');
    const blocked = aiTasks.filter((task) => task.status === 'blocked' || task.status === 'failed');
    const humanHandoffs = aiTasks.filter((task) => task.status === 'waiting_approval');
    const openWakeups = aiWakeupRequests.filter((wakeup) => ['queued', 'claimed', 'running'].includes(wakeup.status));

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

    return (
        <AIWorkspacePage page="tasks">
            <AIPageIntro
                eyebrow="Tasks"
                title="Track execution as live work"
                description="Tasks are now real AI workspace records. This page shows what is queued, what is moving, and where a human still needs to step in."
            />

            <AIStatGrid>
                <AIStatCard label="Open tasks" value={String(openTasks.length)} caption="Not completed or cancelled" tone="info" />
                <AIStatCard label="In motion" value={String(inMotion.length)} caption="Currently running" tone="success" />
                <AIStatCard label="Blocked" value={String(blocked.length)} caption="Failed or blocked tasks" tone="warning" />
                <AIStatCard label="Human handoffs" value={String(humanHandoffs.length)} caption="Waiting on approval" tone="danger" />
                <AIStatCard label="Wakeups live" value={String(openWakeups.length)} caption={`${aiRunEvents.length} run events logged`} tone="info" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard
                    eyebrow="Queue"
                    title="Priority queue"
                    description="Sorted by priority first, then by oldest work."
                >
                    <Stack spacing={1.2}>
                        {tasksWithContext.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No tasks yet. Create one on the right to start the execution queue.
                            </Typography>
                        ) : tasksWithContext.slice(0, 8).map(({ task, agent, project, goal, pendingApproval, activeRun, openWakeups, runEvents, activeSessions }) => (
                            <Stack
                                key={task.id.toString()}
                                spacing={1}
                                sx={{
                                    px: 1.6,
                                    py: 1.4,
                                    borderRadius: '14px',
                                    border: '1px solid #1a1a1a',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {task.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                            {project?.name || 'No project'} • {goal?.title || 'No goal'} • {agent?.name || 'No agent assigned'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            Due {formatRelativeTime(task.dueAt)} • Created {formatBigIntDateTime(task.createdAt)}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            {openWakeups.length} live wakeup{openWakeups.length === 1 ? '' : 's'} • {runEvents.length} run event{runEvents.length === 1 ? '' : 's'} • {activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <AIStatusPill
                                            label={task.status}
                                            tone={
                                                task.status === 'completed'
                                                    ? 'success'
                                                    : task.status === 'waiting_approval'
                                                      ? 'danger'
                                                      : task.status === 'blocked' || task.status === 'failed'
                                                        ? 'warning'
                                                        : 'info'
                                            }
                                        />
                                        <AIStatusPill label={task.priority} tone={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'} />
                                    </Stack>
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                    {task.description || 'No task description yet.'}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        href={`/ai/tasks/${task.id.toString()}`}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Details
                                    </Button>
                                    {task.status === 'queued' ? (
                                        <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => handleStartTask(task.id, task.agentId)}>
                                            Start
                                        </Button>
                                    ) : null}
                                    {task.status === 'running' ? (
                                        <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => handleCompleteTask(task.id, activeRun?.id ?? null)}>
                                            Mark complete
                                        </Button>
                                    ) : null}
                                    {!pendingApproval && !['waiting_approval', 'completed', 'cancelled'].includes(task.status) ? (
                                        <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => handleRequestApproval(task.id, task.agentId, task.title)}>
                                            Request approval
                                        </Button>
                                    ) : null}
                                    {pendingApproval ? (
                                        <Typography variant="caption" sx={{ color: '#ffc47b' }}>
                                            Approval request is already pending.
                                        </Typography>
                                    ) : null}
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Create"
                    title="Add a task"
                    description="Tasks are the work tickets agents and reviewers act on."
                >
                    <Stack component="form" spacing={1.4} onSubmit={handleCreateTask}>
                        <TextField
                            size="small"
                            label="Task title"
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Draft proposal for Northwind renewal"
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
                                sx={{ minWidth: 180 }}
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
                                sx={{ minWidth: 180 }}
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
                                sx={{ minWidth: 180 }}
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
                                sx={{ minWidth: 160 }}
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
                                sx={{ minWidth: 220 }}
                            />
                        </Stack>
                        <Stack direction="row" justifyContent="flex-end">
                            <Button type="submit" variant="contained" disabled={submitting || currentOrgId == null} sx={{ textTransform: 'none' }}>
                                {submitting ? 'Creating...' : 'Create task'}
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Handoffs"
                    title="Waiting on people"
                    description="Tasks and approvals that still need human release."
                >
                    <Stack spacing={1.1}>
                        {humanHandoffs.length === 0 && aiApprovals.filter((approval) => approval.status === 'pending').length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No human handoffs are waiting right now.
                            </Typography>
                        ) : (
                            <>
                                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                    {humanHandoffs.length} tasks are waiting on approval.
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                    {aiApprovals.filter((approval) => approval.status === 'pending').length} approval records are still pending.
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#858585' }}>
                                    Use the Approvals page to decide which tasks can move again.
                                </Typography>
                            </>
                        )}
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Policy"
                    title="Current execution boundaries"
                    description="Keep the first version explicit while the runtime stays approval-gated."
                >
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            New tasks enter the queue immediately, but external actions should still request approval.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Runs and spend tracking can be added later without changing this task model.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            The safest workflow right now is: create task, assign agent, request approval if needed, then mark complete.
                        </Typography>
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiTasksPage = AITasksPage;
