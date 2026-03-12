import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import AiPriorityIcon from './AiPriorityIcon';
import AiStatusBadge from './AiStatusBadge';
import AiCommentThread from './AiCommentThread';
import { Link } from '@tanstack/react-router';
import { useReducer, useSpacetimeDB } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, formatUsd, microusdToUsd, NONE_U64, safeParseBigInt } from './aiUtils';
import { AIRuntimeListCard, humanizeRuntimeToken } from './AIRuntimeDetailBlocks';
import { AILiveRunWidget } from './AILiveRunWidget';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const PRESET_COLORS = [
    '#ef5350', // red
    '#ff9800', // orange
    '#fdd835', // yellow
    '#66bb6a', // green
    '#26c6da', // cyan
    '#42a5f5', // blue
    '#7e57c2', // purple
    '#ec407a', // pink
];

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
        aiLabels,
        aiTaskLabels,
        aiTaskComments,
        aiTaskAttachments,
    } = useAIWorkspaceData();

    const updateAiTaskStatus = useReducer(reducers.updateAiTaskStatus);
    const createAiApproval = useReducer(reducers.createAiApproval);
    const createAiRun = useReducer(reducers.createAiRun);
    const updateAiRunStatus = useReducer(reducers.updateAiRunStatus);
    const enqueueAiWakeupRequest = useReducer(reducers.enqueueAiWakeupRequest);
    const appendAiRunEvent = useReducer(reducers.appendAiRunEvent);
    const addAiTaskLabel = useReducer(reducers.addAiTaskLabel);
    const removeAiTaskLabel = useReducer(reducers.removeAiTaskLabel);
    const createAiLabel = useReducer(reducers.createAiLabel);
    const addAiTaskComment = useReducer(reducers.addAiTaskComment);
    const editAiTaskComment = useReducer(reducers.editAiTaskComment);
    const deleteAiTaskComment = useReducer(reducers.deleteAiTaskComment);
    const addAiTaskAttachment = useReducer(reducers.addAiTaskAttachment);
    const { identity } = useSpacetimeDB();

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

    // Attachment state
    const [attachDialogOpen, setAttachDialogOpen] = useState(false);
    const [attachForm, setAttachForm] = useState({ filename: '', url: '', mimeType: '' });
    const [attachSaving, setAttachSaving] = useState(false);

    const taskAttachments = task
        ? [...aiTaskAttachments]
            .filter((a) => a.taskId === task.id)
            .sort((a, b) => Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch))
        : [];

    const handleAddAttachment = async () => {
        if (!task || !currentOrgId || !attachForm.filename.trim() || !attachForm.url.trim()) return;
        setAttachSaving(true);
        try {
            await addAiTaskAttachment({
                taskId: task.id,
                orgId: currentOrgId,
                filename: attachForm.filename.trim(),
                url: attachForm.url.trim(),
                mimeType: attachForm.mimeType.trim() || 'application/octet-stream',
                sizeBytes: 0n,
            });
            setAttachForm({ filename: '', url: '', mimeType: '' });
            setAttachDialogOpen(false);
        } catch {
            // silently fail — toast will show from reducer error boundary
        } finally {
            setAttachSaving(false);
        }
    };

    // Labels UI state
    const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
    const [showCreateLabel, setShowCreateLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);

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

    // Label derived data
    const currentTaskLabelIds = new Set(
        aiTaskLabels.filter((tl) => task != null && tl.taskId === task.id).map((tl) => tl.labelId)
    );
    const currentTaskLabelObjects = aiLabels.filter((label) => currentTaskLabelIds.has(label.id));
    const availableToAdd = aiLabels.filter((label) => !currentTaskLabelIds.has(label.id));

    const handleRemoveLabel = async (labelId: bigint) => {
        if (!task) return;
        await removeAiTaskLabel({ taskId: task.id, labelId });
    };

    const handleAddLabel = async (labelId: bigint) => {
        if (!task) return;
        await addAiTaskLabel({ taskId: task.id, labelId });
        setLabelDropdownOpen(false);
    };

    const handleCreateLabel = async () => {
        if (!newLabelName.trim() || !currentOrgId) return;
        await createAiLabel({ orgId: currentOrgId, name: newLabelName.trim(), color: newLabelColor });
        setNewLabelName('');
        setNewLabelColor(PRESET_COLORS[0]);
        setShowCreateLabel(false);
        setLabelDropdownOpen(false);
    };

    if (!task) {
        return (
            <AIWorkspacePage page="tasks">
                <Button component={Link} to="/ai/tasks" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0 }}>
                    ← Tasks
                </Button>
                <Typography variant="body2" sx={{ color: '#555' }}>Task not found.</Typography>
            </AIWorkspacePage>
        );
    }

    return (
        <AIWorkspacePage page="tasks">
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.5}>
                    <Button component={Link} to="/ai/tasks" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0, alignSelf: 'flex-start' }}>
                        ← Tasks
                    </Button>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{task.title}</Typography>
                    {task.description && (
                        <Typography variant="body2" sx={{ color: '#858585' }}>{task.description}</Typography>
                    )}
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        {task.status} • {task.priority}
                        {project ? ` • ${project.name}` : ''}
                        {goal ? ` • ${goal.title}` : ''}
                        {agent ? ` • ${agent.name}` : ''}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexShrink={0}>
                    {(task.status === 'queued' || task.status === 'blocked' || task.status === 'failed') && (
                        <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={handleStart}>Start</Button>
                    )}
                    {(task.status === 'running' || task.status === 'waiting_approval') && (
                        <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={handleComplete}>Mark complete</Button>
                    )}
                    {!approvals.some((a) => a.status === 'pending') && !['completed', 'cancelled'].includes(task.status) && (
                        <Button variant="outlined" size="small" sx={{ textTransform: 'none' }} onClick={handleRequestApproval}>Request approval</Button>
                    )}
                </Stack>
            </Stack>

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

            <Stack spacing={2}>
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
                    description="Detailed execution and operator events recorded against this task's runs."
                    items={eventItems}
                    emptyMessage="No runtime events have been recorded for this task yet."
                />
            </Stack>

            {/* ── Priority & Status summary row ── */}
            <Box sx={{ px: 0.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <AiStatusBadge status={task.status} />
                    <AiPriorityIcon priority={task.priority} size={18} showTooltip />
                    <Typography variant="caption" sx={{ color: '#858585' }}>
                        {task.priority} priority
                    </Typography>
                </Stack>
            </Box>

            {/* ── Labels ── */}
            <AISectionCard
                eyebrow="Labels"
                title="Task labels"
                description="Labels help categorise and filter tasks across the board."
            >
                <Stack spacing={1.5}>
                    {/* Current labels */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        {currentTaskLabelObjects.length === 0 ? (
                            <Typography variant="caption" sx={{ color: '#555555', fontStyle: 'italic' }}>
                                No labels on this task yet.
                            </Typography>
                        ) : (
                            currentTaskLabelObjects.map((label) => (
                                <Chip
                                    key={label.id.toString()}
                                    label={label.name}
                                    size="small"
                                    onDelete={() => handleRemoveLabel(label.id)}
                                    sx={{
                                        bgcolor: label.color,
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        fontSize: '0.72rem',
                                        '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#ffffff' } },
                                    }}
                                />
                            ))
                        )}
                    </Stack>

                    {/* Add label / create label controls */}
                    <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                        {!labelDropdownOpen ? (
                            <Button
                                size="small"
                                variant="outlined"
                                sx={{ textTransform: 'none', fontSize: '0.78rem' }}
                                onClick={() => { setLabelDropdownOpen(true); setShowCreateLabel(false); }}
                            >
                                + Add label
                            </Button>
                        ) : (
                            <Stack spacing={1} sx={{ minWidth: 220 }}>
                                <Select
                                    size="small"
                                    displayEmpty
                                    value=""
                                    onChange={(e) => {
                                        const val = e.target.value as string;
                                        if (val === '__create__') {
                                            setShowCreateLabel(true);
                                        } else if (val) {
                                            handleAddLabel(BigInt(val));
                                        }
                                    }}
                                    renderValue={() => 'Select a label'}
                                    sx={{ fontSize: '0.82rem' }}
                                >
                                    {availableToAdd.length === 0 && (
                                        <MenuItem disabled value="">
                                            <Typography variant="caption" sx={{ color: '#777777' }}>
                                                No labels available
                                            </Typography>
                                        </MenuItem>
                                    )}
                                    {availableToAdd.map((label) => (
                                        <MenuItem key={label.id.toString()} value={label.id.toString()}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: label.color, flexShrink: 0 }} />
                                                <Typography variant="body2">{label.name}</Typography>
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                    <MenuItem value="__create__">
                                        <Typography variant="body2" sx={{ color: '#42a5f5' }}>
                                            + Create label
                                        </Typography>
                                    </MenuItem>
                                </Select>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#666666', alignSelf: 'flex-start' }}
                                    onClick={() => { setLabelDropdownOpen(false); setShowCreateLabel(false); }}
                                >
                                    Cancel
                                </Button>
                            </Stack>
                        )}

                        {/* Inline create label form */}
                        {showCreateLabel && (
                            <Stack
                                spacing={1}
                                sx={{
                                    p: 1.5,
                                    borderRadius: '10px',
                                    border: '1px solid #1e1e1e',
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    minWidth: 260,
                                }}
                            >
                                <Typography variant="caption" sx={{ color: '#aaaaaa', fontWeight: 600 }}>
                                    New label
                                </Typography>
                                <TextField
                                    size="small"
                                    label="Label name"
                                    value={newLabelName}
                                    onChange={(e) => setNewLabelName(e.target.value)}
                                    placeholder="e.g. needs-review"
                                    autoFocus
                                    sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem' } }}
                                />
                                <Stack spacing={0.6}>
                                    <Typography variant="caption" sx={{ color: '#777777' }}>
                                        Color
                                    </Typography>
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        {PRESET_COLORS.map((color) => (
                                            <Box
                                                key={color}
                                                onClick={() => setNewLabelColor(color)}
                                                sx={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    bgcolor: color,
                                                    cursor: 'pointer',
                                                    border: newLabelColor === color ? '2px solid #ffffff' : '2px solid transparent',
                                                    boxSizing: 'border-box',
                                                    transition: 'border-color 0.15s',
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </Stack>
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button
                                        size="small"
                                        variant="text"
                                        sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#666666' }}
                                        onClick={() => { setShowCreateLabel(false); setNewLabelName(''); setNewLabelColor(PRESET_COLORS[0]); }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={!newLabelName.trim() || currentOrgId == null}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        onClick={handleCreateLabel}
                                    >
                                        Create
                                    </Button>
                                </Stack>
                            </Stack>
                        )}
                    </Stack>
                </Stack>
            </AISectionCard>

            {/* ── Attachments ── */}
            <AISectionCard
                eyebrow="Files"
                title="Attachments"
                description={taskAttachments.length > 0 ? `${taskAttachments.length} file${taskAttachments.length !== 1 ? 's' : ''}` : 'Link external files and resources'}
            >
                <Stack spacing={1}>
                    {taskAttachments.length > 0 && (
                        <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                            {taskAttachments.map((att, i) => (
                                <Stack
                                    key={att.id.toString()}
                                    direction="row"
                                    alignItems="center"
                                    spacing={1.5}
                                    sx={{
                                        px: 2,
                                        py: 1.25,
                                        borderBottom: i < taskAttachments.length - 1 ? '1px solid #1a1a1a' : 'none',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                    }}
                                >
                                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 16, color: '#555', flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            component="a"
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="body2"
                                            sx={{ color: '#7eb0ff', fontWeight: 500, textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        >
                                            {att.filename}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#555' }}>
                                            {att.mimeType || 'file'}
                                            {att.sizeBytes > 0n ? ` • ${(Number(att.sizeBytes) / 1024).toFixed(1)} KB` : ''}
                                        </Typography>
                                    </Box>
                                    <Tooltip title="Open in new tab">
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}>
                                            <IconButton size="small" sx={{ color: '#555', '&:hover': { color: '#7eb0ff' } }}>
                                                <AttachFileIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </a>
                                    </Tooltip>
                                </Stack>
                            ))}
                        </Box>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        onClick={() => setAttachDialogOpen(true)}
                        sx={{ textTransform: 'none', alignSelf: 'flex-start', fontSize: '0.78rem' }}
                    >
                        Add attachment
                    </Button>
                </Stack>
            </AISectionCard>

            {/* Attachment dialog */}
            <Dialog open={attachDialogOpen} onClose={() => setAttachDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
                <DialogTitle sx={{ color: '#fff' }}>Add attachment</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        <TextField
                            size="small"
                            label="File name"
                            required
                            value={attachForm.filename}
                            onChange={(e) => setAttachForm((f) => ({ ...f, filename: e.target.value }))}
                            placeholder="e.g. design-spec.pdf"
                            fullWidth
                        />
                        <TextField
                            size="small"
                            label="URL"
                            required
                            value={attachForm.url}
                            onChange={(e) => setAttachForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="https://..."
                            fullWidth
                        />
                        <TextField
                            size="small"
                            label="MIME type (optional)"
                            value={attachForm.mimeType}
                            onChange={(e) => setAttachForm((f) => ({ ...f, mimeType: e.target.value }))}
                            placeholder="e.g. application/pdf, image/png"
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setAttachDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" disabled={attachSaving || !attachForm.filename.trim() || !attachForm.url.trim()} onClick={handleAddAttachment} sx={{ textTransform: 'none' }}>
                        {attachSaving ? 'Saving…' : 'Attach'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Comments ── */}
            <AISectionCard
                eyebrow="Discussion"
                title="Comments"
                description="Leave notes and updates for this task."
            >
                <AiCommentThread
                    taskId={task.id}
                    conn={{
                        reducers: {
                            addAiTaskComment: (args) => addAiTaskComment(args),
                            editAiTaskComment: (args) => editAiTaskComment(args),
                            deleteAiTaskComment: (args) => deleteAiTaskComment(args),
                        },
                    }}
                    comments={aiTaskComments
                        .filter((c) => c.taskId === task.id && !c.isDeleted)
                        .map((c) => ({
                            id: c.id,
                            taskId: c.taskId,
                            authorIdentity: c.authorIdentity.toHexString(),
                            body: c.body,
                            createdAt: c.createdAt.microsSinceUnixEpoch,
                            updatedAt: c.updatedAt.microsSinceUnixEpoch,
                        }))}
                    currentIdentityHex={identity?.toHexString() ?? ''}
                />
            </AISectionCard>
        </AIWorkspacePage>
    );
}

export const AiTaskDetailPage = AITaskDetailPage;
