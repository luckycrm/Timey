import { useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, formatUsd, microusdToUsd, NONE_U64, safeParseBigInt } from './aiUtils';
import { AIRuntimeListCard, humanizeRuntimeToken } from './AIRuntimeDetailBlocks';
import { AILiveRunWidget } from './AILiveRunWidget';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const wakeupSourceOptions = ['manual', 'timer', 'assignment', 'automation'] as const;
const runEventLevelOptions = ['info', 'warning', 'error', 'debug'] as const;

function isWakeupOpen(status: string) {
    return status === 'queued' || status === 'claimed' || status === 'running';
}

export function AITaskDetailPage({ taskId }: { taskId: string }) {
    const parsedId = safeParseBigInt(taskId);
    const {
        currentOrgId,
        aiTasks,
        aiProjects,
        aiGoals,
        aiAgents,
        aiApprovals,
        aiRuns,
        aiRunEvents,
        aiWakeupRequests,
        aiAdapterSessions,
        aiAgentRuntimeByAgentId,
        aiSettings,
    } = useAIWorkspaceData();

    const updateAiTaskStatus = useReducer(reducers.updateAiTaskStatus);
    const createAiApproval = useReducer(reducers.createAiApproval);
    const createAiRun = useReducer(reducers.createAiRun);
    const updateAiRunStatus = useReducer(reducers.updateAiRunStatus);
    const enqueueAiWakeupRequest = useReducer(reducers.enqueueAiWakeupRequest);
    const appendAiRunEvent = useReducer(reducers.appendAiRunEvent);

    const task = parsedId == null ? null : aiTasks.find((row) => row.id === parsedId) ?? null;
    const project = task ? aiProjects.find((row) => row.id === task.projectId) ?? null : null;
    const goal = task ? aiGoals.find((row) => row.id === task.goalId) ?? null : null;
    const agent = task ? aiAgents.find((row) => row.id === task.agentId) ?? null : null;
    const runtime = agent ? aiAgentRuntimeByAgentId.get(agent.id) ?? null : null;
    const approvals = task
        ? [...aiApprovals]
            .filter((approval) => approval.taskId === task.id)
            .sort((left, right) => Number(right.createdAt - left.createdAt))
        : [];
    const runs = task
        ? [...aiRuns]
            .filter((run) => run.taskId === task.id)
            .sort((left, right) => Number(right.createdAt - left.createdAt))
        : [];
    const activeRun = runs.find((run) => run.status === 'running' || run.status === 'waiting_approval') ?? null;
    const latestRun = runs[0] ?? null;
    const pendingApproval = approvals.find((approval) => approval.status === 'pending') ?? null;
    const wakeups = task
        ? [...aiWakeupRequests]
            .filter((wakeup) => wakeup.taskId === task.id)
            .sort((left, right) => Number(right.createdAt - left.createdAt))
        : [];
    const openWakeups = wakeups.filter((wakeup) => isWakeupOpen(wakeup.status));
    const runIds = new Set(runs.map((run) => run.id));
    const runEvents = task
        ? [...aiRunEvents]
            .filter((event) => event.taskId === task.id || runIds.has(event.runId))
            .sort((left, right) => Number(right.createdAt - left.createdAt))
        : [];
    const adapterSessions = task
        ? [...aiAdapterSessions]
            .filter((session) => session.runId !== NONE_U64 && runIds.has(session.runId))
            .sort((left, right) => Number(right.updatedAt - left.updatedAt))
        : [];

    const [wakeupForm, setWakeupForm] = useState({
        source: 'manual',
        reason: '',
        payloadJson: '{}',
    });
    const [runEventForm, setRunEventForm] = useState({
        level: 'info',
        message: '',
        payloadJson: '{}',
    });
    const [queueingWakeup, setQueueingWakeup] = useState(false);
    const [savingRunEvent, setSavingRunEvent] = useState(false);

    const wakeupItems = wakeups.slice(0, 8).map((wakeup) => ({
        key: wakeup.id.toString(),
        title: wakeup.reason || `Wakeup ${wakeup.id.toString()}`,
        subtitle: `${humanizeRuntimeToken(wakeup.source)} • ${formatBigIntDateTime(wakeup.createdAt)}`,
        meta: `${humanizeRuntimeToken(wakeup.status)}${wakeup.errorMessage ? ` • ${wakeup.errorMessage}` : ''}`,
        badges: [
            { label: humanizeRuntimeToken(wakeup.status), tone: wakeup.status === 'failed' ? 'danger' as const : isWakeupOpen(wakeup.status) ? 'info' as const : 'neutral' as const },
            ...(wakeup.runId !== NONE_U64 ? [{ label: 'run linked', tone: 'neutral' as const }] : []),
        ],
        actions: agent ? [{ label: 'Open agent', href: `/ai/agents/${agent.id.toString()}` }] : [],
    }));

    const runItems = runs.slice(0, 8).map((run) => ({
        key: run.id.toString(),
        title: run.summary || `${humanizeRuntimeToken(run.status)} run`,
        subtitle: `${humanizeRuntimeToken(run.triggerType)} • ${formatBigIntDateTime(run.createdAt)}`,
        meta: `${formatUsd(microusdToUsd(run.costMicrousd))} • ${run.toolCalls.toString()} tool call${run.toolCalls === 1n ? '' : 's'}${run.errorMessage ? ` • ${run.errorMessage}` : ''}`,
        badges: [
            { label: humanizeRuntimeToken(run.status), tone: run.status === 'completed' ? 'success' as const : run.status === 'failed' ? 'danger' as const : run.status === 'waiting_approval' ? 'warning' as const : 'info' as const },
            { label: `${run.tokenInput.toString()} in / ${run.tokenOutput.toString()} out`, tone: 'neutral' as const },
        ],
    }));

    const sessionItems = adapterSessions.slice(0, 8).map((session) => ({
        key: session.id.toString(),
        title: session.summary || humanizeRuntimeToken(session.adapterType),
        subtitle: `${humanizeRuntimeToken(session.status)} • ${session.externalSessionId}`,
        meta: `Last seen ${session.lastSeenAt !== NONE_U64 ? formatRelativeTime(session.lastSeenAt) : 'not recorded'}${session.metadataJson && session.metadataJson !== '{}' ? ` • ${session.metadataJson}` : ''}`,
        badges: [
            { label: humanizeRuntimeToken(session.adapterType), tone: 'info' as const },
            { label: humanizeRuntimeToken(session.status), tone: session.status === 'active' ? 'success' as const : session.status === 'failed' ? 'danger' as const : 'neutral' as const },
        ],
    }));

    const eventItems = runEvents.slice(0, 10).map((event) => ({
        key: event.id.toString(),
        title: event.message,
        subtitle: `${humanizeRuntimeToken(event.eventType)} • ${formatBigIntDateTime(event.createdAt)}`,
        meta: event.payloadJson && event.payloadJson !== '{}' ? event.payloadJson : 'No payload recorded.',
        badges: [
            { label: humanizeRuntimeToken(event.level), tone: event.level === 'error' ? 'danger' as const : event.level === 'warning' ? 'warning' as const : 'info' as const },
            ...(event.runId !== NONE_U64 ? [{ label: 'run', tone: 'neutral' as const }] : []),
        ],
    }));

    const handleStart = async () => {
        if (!task || currentOrgId == null) return;
        try {
            await updateAiTaskStatus({ taskId: task.id, status: 'running' });
            try {
                await createAiRun({
                    orgId: currentOrgId,
                    taskId: task.id,
                    agentId: task.agentId === NONE_U64 ? 0n : task.agentId,
                    status: 'running',
                    triggerType: 'manual',
                    summary: 'Started from task detail',
                    errorMessage: '',
                    tokenInput: 0n,
                    tokenOutput: 0n,
                    toolCalls: 0n,
                    costMicrousd: 0n,
                });
            } catch (error) {
                await updateAiTaskStatus({ taskId: task.id, status: 'queued' }).catch(() => {});
                throw error;
            }
            toast.success('Task started');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start task');
        }
    };

    const handleComplete = async () => {
        if (!task) return;
        try {
            await updateAiTaskStatus({ taskId: task.id, status: 'completed' });
            if (activeRun) {
                try {
                    await updateAiRunStatus({
                        runId: activeRun.id,
                        status: 'completed',
                        summary: 'Completed from task detail',
                        errorMessage: '',
                        tokenInput: 0n,
                        tokenOutput: 0n,
                        toolCalls: 0n,
                        costMicrousd: 0n,
                    });
                } catch (error) {
                    await updateAiTaskStatus({ taskId: task.id, status: 'running' }).catch(() => {});
                    throw error;
                }
            }
            toast.success('Task completed');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to complete task');
        }
    };

    const handleRequestApproval = async () => {
        if (!task || currentOrgId == null) return;
        try {
            await createAiApproval({
                orgId: currentOrgId,
                taskId: task.id,
                agentId: task.agentId === NONE_U64 ? 0n : task.agentId,
                title: `Review ${task.title}`,
                summary: `Approve or reject the next action for "${task.title}".`,
                riskLevel: 'medium',
                actionType: 'task_release',
                metadataJson: '{}',
            });
            toast.success('Approval requested');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to request approval');
        }
    };

    const handleQueueWakeup = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!task || currentOrgId == null || task.agentId === NONE_U64) return;
        try {
            setQueueingWakeup(true);
            await enqueueAiWakeupRequest({
                orgId: currentOrgId,
                agentId: task.agentId,
                taskId: task.id,
                source: wakeupForm.source,
                reason: wakeupForm.reason.trim() || `Resume ${task.title}`,
                payloadJson: wakeupForm.payloadJson.trim() || '{}',
            });
            setWakeupForm({
                source: 'manual',
                reason: '',
                payloadJson: '{}',
            });
            toast.success('Wakeup queued');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to queue wakeup');
        } finally {
            setQueueingWakeup(false);
        }
    };

    const handleAppendRunEvent = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!task || currentOrgId == null || latestRun == null) return;
        try {
            setSavingRunEvent(true);
            await appendAiRunEvent({
                orgId: currentOrgId,
                runId: latestRun.id,
                agentId: task.agentId === NONE_U64 ? 0n : task.agentId,
                taskId: task.id,
                eventType: 'operator_note',
                level: runEventForm.level,
                message: runEventForm.message.trim(),
                payloadJson: runEventForm.payloadJson.trim() || '{}',
            });
            setRunEventForm({
                level: 'info',
                message: '',
                payloadJson: '{}',
            });
            toast.success('Run event logged');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to log run event');
        } finally {
            setSavingRunEvent(false);
        }
    };

    if (!task) {
        return (
            <AIWorkspacePage page="tasks">
                <AIPageIntro
                    eyebrow="Tasks"
                    title="Task not found"
                    description="The requested task does not exist in this workspace or the id is invalid."
                    actionSlot={(
                        <Button component={Link} to="/ai/tasks" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back to tasks
                        </Button>
                    )}
                />
            </AIWorkspacePage>
        );
    }

    return (
        <AIWorkspacePage page="tasks">
            <AIPageIntro
                eyebrow="Task detail"
                title={task.title}
                description={task.description || 'No task description yet.'}
                supportingCopy={`${project?.name || 'No project'}${goal ? ` • ${goal.title}` : ''}${agent ? ` • ${agent.name}` : ''}`}
                actionSlot={(
                    <Stack direction="row" spacing={1}>
                        <Button component={Link} to="/ai/tasks" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back
                        </Button>
                        {task.status === 'queued' ? (
                            <Button variant="contained" sx={{ textTransform: 'none' }} onClick={handleStart}>
                                Start
                            </Button>
                        ) : null}
                        {task.status === 'running' ? (
                            <Button variant="contained" sx={{ textTransform: 'none' }} onClick={handleComplete}>
                                Mark complete
                            </Button>
                        ) : null}
                        {!approvals.some((approval) => approval.status === 'pending') && !['completed', 'cancelled'].includes(task.status) ? (
                            <Button variant="outlined" sx={{ textTransform: 'none' }} onClick={handleRequestApproval}>
                                Request approval
                            </Button>
                        ) : null}
                    </Stack>
                )}
            />

            <AILiveRunWidget
                task={task}
                agent={agent}
                runtime={runtime || null}
                activeRun={activeRun}
                latestRun={latestRun}
                wakeups={wakeups}
                runEvents={runEvents}
                adapterSessions={adapterSessions}
                aiSettings={aiSettings}
                pendingApprovalTitle={pendingApproval?.title || null}
                actionSlot={(
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {(task.status === 'queued' || task.status === 'blocked' || task.status === 'failed') ? (
                            <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={handleStart}>
                                Start task
                            </Button>
                        ) : null}
                        {(task.status === 'running' || task.status === 'waiting_approval') ? (
                            <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={handleComplete}>
                                Mark complete
                            </Button>
                        ) : null}
                        {!approvals.some((approval) => approval.status === 'pending') && !['completed', 'cancelled'].includes(task.status) ? (
                            <Button variant="outlined" size="small" sx={{ textTransform: 'none' }} onClick={handleRequestApproval}>
                                Request approval
                            </Button>
                        ) : null}
                    </Stack>
                )}
            />

            <AIStatGrid>
                <AIStatCard label="Status" value={task.status} caption="Current workflow state" tone={task.status === 'completed' ? 'success' : task.status === 'blocked' || task.status === 'failed' ? 'warning' : 'info'} />
                <AIStatCard label="Priority" value={task.priority} caption={`Due ${formatRelativeTime(task.dueAt)}`} tone={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'} />
                <AIStatCard label="Wakeups" value={String(openWakeups.length)} caption={`${wakeups.length} total wakeup records`} tone="warning" />
                <AIStatCard label="Runs" value={String(runs.length)} caption={activeRun ? 'Active run in progress' : 'No active run'} tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Context" title="Linked records" description="Project, goal, and agent context for this task.">
                    <Stack spacing={1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Project: {project?.name || 'Not linked'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Goal: {goal?.title || 'Not linked'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Agent: {agent?.name || 'Not assigned'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Created {formatBigIntDateTime(task.createdAt)} • Updated {formatBigIntDateTime(task.updatedAt)}
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Wake this task" title="Queue a wakeup" description="Use this when the runtime should pick the task back up, even if it is waiting in the queue.">
                    <Stack component="form" spacing={1.2} onSubmit={handleQueueWakeup}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Wakeup source"
                                value={wakeupForm.source}
                                onChange={(event) => setWakeupForm((current) => ({ ...current, source: event.target.value }))}
                                sx={{ minWidth: 180 }}
                            >
                                {wakeupSourceOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {humanizeRuntimeToken(option)}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Reason"
                                value={wakeupForm.reason}
                                onChange={(event) => setWakeupForm((current) => ({ ...current, reason: event.target.value }))}
                                placeholder="Retry after updating the proposal brief."
                                fullWidth
                            />
                        </Stack>
                        <TextField
                            size="small"
                            label="Payload JSON"
                            value={wakeupForm.payloadJson}
                            onChange={(event) => setWakeupForm((current) => ({ ...current, payloadJson: event.target.value }))}
                            multiline
                            minRows={3}
                        />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                {task.agentId === NONE_U64 ? 'Assign an agent before queueing a wakeup.' : 'Queue entries are written directly to the wakeup table for this task.'}
                            </Typography>
                            <Button type="submit" variant="outlined" disabled={currentOrgId == null || task.agentId === NONE_U64 || queueingWakeup} sx={{ textTransform: 'none' }}>
                                Queue wakeup
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Run log" title="Append operator note" description="Add a structured event to the latest run without leaving this task surface.">
                    <Stack component="form" spacing={1.2} onSubmit={handleAppendRunEvent}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Level"
                                value={runEventForm.level}
                                onChange={(event) => setRunEventForm((current) => ({ ...current, level: event.target.value }))}
                                sx={{ minWidth: 180 }}
                            >
                                {runEventLevelOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {humanizeRuntimeToken(option)}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Message"
                                value={runEventForm.message}
                                onChange={(event) => setRunEventForm((current) => ({ ...current, message: event.target.value }))}
                                placeholder="Operator reviewed the output and updated the client scope."
                                fullWidth
                            />
                        </Stack>
                        <TextField
                            size="small"
                            label="Payload JSON"
                            value={runEventForm.payloadJson}
                            onChange={(event) => setRunEventForm((current) => ({ ...current, payloadJson: event.target.value }))}
                            multiline
                            minRows={3}
                        />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                {latestRun ? `This note will attach to run ${latestRun.id.toString()}.` : 'Start a run first to attach operator notes.'}
                            </Typography>
                            <Button type="submit" variant="outlined" disabled={currentOrgId == null || latestRun == null || savingRunEvent || runEventForm.message.trim().length === 0} sx={{ textTransform: 'none' }}>
                                Log run event
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AIRuntimeListCard
                    eyebrow="Wakeups"
                    title="Wakeup queue"
                    description="Actual wakeup records for this task, including failures and linked run ids."
                    items={wakeupItems}
                    emptyMessage="No wakeup records have been written for this task yet."
                />

                <AISectionCard eyebrow="Approvals" title="Approval history" description="All approval requests linked to this task.">
                    <Stack spacing={1}>
                        {approvals.slice(0, 6).map((approval) => (
                            <Stack key={approval.id.toString()} spacing={0.35}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {approval.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {approval.status} • {approval.riskLevel} • {formatBigIntDateTime(approval.createdAt)}
                                </Typography>
                            </Stack>
                        ))}
                        {approvals.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No approvals have been requested for this task yet.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>

                <AIRuntimeListCard
                    eyebrow="Runs"
                    title="Run history"
                    description="Latest execution runs for this task."
                    items={runItems}
                    emptyMessage="No execution runs have been recorded for this task yet."
                />

                <AIRuntimeListCard
                    eyebrow="Sessions"
                    title="Adapter sessions"
                    description="Task-scoped adapter sessions derived from runs linked to this task."
                    items={sessionItems}
                    emptyMessage="No adapter sessions have been recorded for this task yet."
                />

                <AIRuntimeListCard
                    eyebrow="Events"
                    title="Run event timeline"
                    description="Detailed execution and operator events recorded against this task’s runs."
                    items={eventItems}
                    emptyMessage="No runtime events have been recorded for this task yet."
                />
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiTaskDetailPage = AITaskDetailPage;
