import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, formatUsd, microusdToUsd, NONE_U64, parseJsonList, safeParseBigInt } from './aiUtils';
import { AIRuntimeListCard, AIRuntimeSlotsCard, humanizeRuntimeToken, readEnabledIntegrationLabels } from './AIRuntimeDetailBlocks';
import { AIRevisionHistoryCard } from './AIRevisionHistoryCard';
import { useAIWorkspaceData } from './useAIWorkspaceData';
import { AdapterConfigForm } from './adapters/AdapterConfigForm';
import type { AdapterType } from './adapters/AdapterTypes';
import { adapterTypeOptions } from './adapters/adapterRegistry';

// Adapter type options: manual + all registry types
const runtimeAdapterOptions: Array<{ value: string; label: string }> = [
    { value: 'manual', label: 'Manual' },
    ...adapterTypeOptions,
];
const runtimeStatusOptions = ['idle', 'ready', 'disabled', 'error'] as const;
const wakeupSourceOptions = ['manual', 'timer', 'assignment', 'automation'] as const;

function parseConfigRevisionMetadata(value: string): Record<string, string> {
    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .filter(([, entry]) => entry != null && String(entry).trim().length > 0)
                .map(([key, entry]) => [key, String(entry)])
        );
    } catch {
        return {};
    }
}

function summarizeRuntimeRevision(revision: { payloadJson: string }) {
    try {
        const parsed = JSON.parse(revision.payloadJson) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'Saved runtime snapshot';

        const adapter = typeof parsed.adapter_type === 'string' ? humanizeRuntimeToken(parsed.adapter_type) : null;
        const status = typeof parsed.runtime_status === 'string' ? humanizeRuntimeToken(parsed.runtime_status) : null;
        const target = typeof parsed.base_url === 'string' && parsed.base_url.trim().length > 0
            ? parsed.base_url
            : typeof parsed.command === 'string' && parsed.command.trim().length > 0
                ? parsed.command
                : typeof parsed.cwd === 'string' && parsed.cwd.trim().length > 0
                    ? parsed.cwd
                    : null;
        return [adapter, status, target].filter(Boolean).join(' • ') || 'Saved runtime snapshot';
    } catch {
        return 'Saved runtime snapshot';
    }
}

function badgesForRuntimeRevision(revision: { metadataJson: string }) {
    const metadata = parseConfigRevisionMetadata(revision.metadataJson);
    const badges: Array<{ label: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = [];

    if (metadata.adapter_type) {
        badges.push({ label: humanizeRuntimeToken(metadata.adapter_type), tone: 'info' });
    }
    if (metadata.runtime_status) {
        badges.push({
            label: humanizeRuntimeToken(metadata.runtime_status),
            tone: metadata.runtime_status === 'ready' ? 'success' : metadata.runtime_status === 'error' ? 'warning' : 'neutral',
        });
    }
    if (metadata.restored_from_revision_id) {
        badges.push({ label: `Restored from ${metadata.restored_from_revision_id}`, tone: 'success' });
    }

    return badges;
}

function readAgentSchedule(value: string): { cadence: string; triggers: string[] } {
    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        const cadence = typeof parsed.cadence === 'string' && parsed.cadence.trim()
            ? parsed.cadence.trim()
            : 'manual';
        const triggers = Array.isArray(parsed.triggers)
            ? parsed.triggers.map((item) => String(item)).filter(Boolean)
            : [];
        return { cadence, triggers };
    } catch {
        return { cadence: 'manual', triggers: [] };
    }
}

function isWakeupOpen(status: string) {
    return status === 'queued' || status === 'claimed' || status === 'running';
}

export function AIAgentDetailPage({ agentId }: { agentId: string }) {
    const parsedId = safeParseBigInt(agentId);
    const {
        currentOrgId,
        isOwner,
        aiAgents,
        aiProjects,
        aiTasks,
        aiApprovals,
        aiConfigRevisions,
        aiRuns,
        aiRunEvents,
        aiWakeupRequests,
        aiAdapterSessions,
        aiAgentRuntimeByAgentId,
        aiSettings,
        usersById,
    } = useAIWorkspaceData();

    const updateAiAgentStatus = useReducer(reducers.updateAiAgentStatus);
    const upsertAiAgentRuntime = useReducer(reducers.upsertAiAgentRuntime);
    const restoreAiAgentRuntimeRevision = useReducer(reducers.restoreAiAgentRuntimeRevision);
    const enqueueAiWakeupRequest = useReducer(reducers.enqueueAiWakeupRequest);

    const agent = parsedId == null ? null : aiAgents.find((row) => row.id === parsedId) ?? null;
    const project = agent ? aiProjects.find((row) => row.id === agent.projectId) ?? null : null;
    const owner = agent ? usersById.get(agent.ownerUserId) ?? null : null;
    const runtime = agent ? aiAgentRuntimeByAgentId.get(agent.id) ?? null : null;
    const tools = agent ? parseJsonList(agent.toolsJson) : [];
    const schedule = agent ? readAgentSchedule(agent.scheduleJson) : { cadence: 'manual', triggers: [] };
    const integrationLabels = aiSettings ? readEnabledIntegrationLabels(aiSettings.integrationsJson) : [];
    const integrationSummary = integrationLabels.length === 0
        ? 'No adapters configured'
        : integrationLabels.length <= 2
            ? integrationLabels.join(' + ')
            : `${integrationLabels.slice(0, 2).join(' + ')} +${integrationLabels.length - 2}`;
    const relatedTasks = useMemo(
        () => (agent ? aiTasks.filter((task) => task.agentId === agent.id) : []),
        [agent, aiTasks]
    );
    const relatedApprovals = useMemo(
        () => (agent ? aiApprovals.filter((approval) => approval.agentId === agent.id) : []),
        [agent, aiApprovals]
    );
    const relatedRuns = useMemo(
        () => (
            agent
                ? [...aiRuns]
                    .filter((run) => run.agentId === agent.id)
                    .sort((left, right) => Number(right.createdAt - left.createdAt))
                : []
        ),
        [agent, aiRuns]
    );
    const relatedRunIds = useMemo(() => new Set(relatedRuns.map((run) => run.id)), [relatedRuns]);
    const relatedRunEvents = useMemo(
        () => (
            agent
                ? [...aiRunEvents]
                    .filter((event) => event.agentId === agent.id || relatedRunIds.has(event.runId))
                    .sort((left, right) => Number(right.createdAt - left.createdAt))
                : []
        ),
        [agent, aiRunEvents, relatedRunIds]
    );
    const relatedWakeups = useMemo(
        () => (
            agent
                ? [...aiWakeupRequests]
                    .filter((wakeup) => wakeup.agentId === agent.id)
                    .sort((left, right) => Number(right.createdAt - left.createdAt))
                : []
        ),
        [agent, aiWakeupRequests]
    );
    const relatedSessions = useMemo(
        () => (
            agent
                ? [...aiAdapterSessions]
                    .filter((session) => session.agentId === agent.id)
                    .sort((left, right) => Number(right.updatedAt - left.updatedAt))
                : []
        ),
        [agent, aiAdapterSessions]
    );
    const runtimeRevisions = useMemo(
        () => (
            agent
                ? [...aiConfigRevisions]
                    .filter((revision) => revision.scopeType === 'agent_runtime' && revision.scopeId === agent.id)
                    .sort((left, right) => Number(right.createdAt - left.createdAt))
                    .slice(0, 8)
                : []
        ),
        [agent, aiConfigRevisions]
    );
    const liveRuns = relatedRuns.filter((run) => run.status === 'running' || run.status === 'waiting_approval');
    const failedRuns = relatedRuns.filter((run) => run.status === 'failed');
    const openWakeups = relatedWakeups.filter((wakeup) => isWakeupOpen(wakeup.status));
    const pendingApprovals = relatedApprovals.filter((approval) => approval.status === 'pending');

    const [runtimeForm, setRuntimeForm] = useState({
        adapterType: 'manual',
        runtimeStatus: 'idle',
        baseUrl: '',
        command: '',
        cwd: '',
        envJson: '{}',
        configJson: '{}',
        heartbeatPolicyJson: '{}',
        wakePolicyJson: '{}',
    });
    const [wakeupForm, setWakeupForm] = useState({
        taskId: '0',
        source: 'manual',
        reason: '',
        payloadJson: '{}',
    });
    const [adapterConfig, setAdapterConfig] = useState<Record<string, unknown>>({});
    const [savingRuntime, setSavingRuntime] = useState(false);
    const [queueingWakeup, setQueueingWakeup] = useState(false);
    const [restoringRevisionId, setRestoringRevisionId] = useState<bigint | null>(null);

    useEffect(() => {
        let parsedConfig: Record<string, unknown> = {};
        try { parsedConfig = JSON.parse(runtime?.configJson || '{}') as Record<string, unknown>; } catch { /* ignore */ }
        setRuntimeForm({
            adapterType: runtime?.adapterType || 'manual',
            runtimeStatus: runtime?.runtimeStatus || 'idle',
            baseUrl: runtime?.baseUrl || '',
            command: runtime?.command || '',
            cwd: runtime?.cwd || '',
            envJson: runtime?.envJson || '{}',
            configJson: runtime?.configJson || '{}',
            heartbeatPolicyJson: runtime?.heartbeatPolicyJson || '{}',
            wakePolicyJson: runtime?.wakePolicyJson || '{}',
        });
        setAdapterConfig(parsedConfig);
    }, [runtime]);

    const runtimeSlots = [
        {
            label: 'Default model',
            value: aiSettings?.defaultModel || 'Not configured',
            tone: aiSettings?.defaultModel ? 'info' as const : 'neutral' as const,
            helper: 'Workspace default used for new runs unless this agent gets an adapter-specific override.',
        },
        {
            label: 'Runtime adapter',
            value: runtime ? humanizeRuntimeToken(runtime.adapterType) : 'Not attached',
            tone: runtime ? 'info' as const : 'warning' as const,
            helper: runtime?.baseUrl || runtime?.command || 'Attach a process or HTTP runtime to move this agent off manual execution.',
        },
        {
            label: 'Runtime status',
            value: runtime ? humanizeRuntimeToken(runtime.runtimeStatus) : 'Idle',
            tone: runtime?.runtimeStatus === 'ready' ? 'success' as const : runtime?.runtimeStatus === 'error' ? 'danger' as const : 'neutral' as const,
            helper: runtime?.lastHeartbeatAt && runtime.lastHeartbeatAt !== NONE_U64
                ? `Last heartbeat ${formatRelativeTime(runtime.lastHeartbeatAt)}`
                : 'No heartbeat has been recorded for this agent yet.',
        },
        {
            label: 'Wake cadence',
            value: humanizeRuntimeToken(schedule.cadence),
            tone: schedule.cadence === 'manual' ? 'neutral' as const : 'info' as const,
            helper: schedule.triggers.length > 0
                ? `Triggers configured: ${schedule.triggers.map((trigger) => humanizeRuntimeToken(trigger)).join(', ')}.`
                : 'No automatic triggers are configured yet.',
        },
        {
            label: 'Fallback mode',
            value: humanizeRuntimeToken(aiSettings?.fallbackMode || 'human-first'),
            tone: 'warning' as const,
            helper: `${pendingApprovals.length} approval gate${pendingApprovals.length === 1 ? '' : 's'} are currently attached to this agent.`,
        },
        {
            label: 'Adapter path',
            value: integrationSummary,
            tone: integrationLabels.length > 0 ? 'success' as const : 'warning' as const,
            helper: `${relatedSessions.length} adapter session${relatedSessions.length === 1 ? '' : 's'} recorded so far.`,
        },
    ];

    const runtimeBadges = [
        { label: agent?.status || 'unknown', tone: agent?.status === 'active' ? 'success' as const : agent?.status === 'attention' ? 'warning' as const : 'neutral' as const },
        { label: openWakeups.length > 0 ? `${openWakeups.length} live wakeup${openWakeups.length === 1 ? '' : 's'}` : 'queue clear', tone: openWakeups.length > 0 ? 'info' as const : 'success' as const },
        { label: failedRuns.length > 0 ? `${failedRuns.length} failed run${failedRuns.length === 1 ? '' : 's'}` : 'stable queue', tone: failedRuns.length > 0 ? 'danger' as const : 'success' as const },
    ];

    const wakeupItems = relatedWakeups.slice(0, 8).map((wakeup) => {
        const task = relatedTasks.find((item) => item.id === wakeup.taskId) ?? null;
        return {
            key: wakeup.id.toString(),
            title: task?.title || wakeup.reason || `Wakeup ${wakeup.id.toString()}`,
            subtitle: `${humanizeRuntimeToken(wakeup.source)} • ${formatBigIntDateTime(wakeup.createdAt)}`,
            meta: `${humanizeRuntimeToken(wakeup.status)}${wakeup.errorMessage ? ` • ${wakeup.errorMessage}` : ''}`,
            badges: [
                { label: humanizeRuntimeToken(wakeup.status), tone: wakeup.status === 'failed' ? 'danger' as const : isWakeupOpen(wakeup.status) ? 'info' as const : 'neutral' as const },
                ...(task ? [{ label: humanizeRuntimeToken(task.priority), tone: task.priority === 'high' || task.priority === 'urgent' ? 'warning' as const : 'neutral' as const }] : []),
            ],
            actions: [
                ...(task ? [{ label: 'Open task', href: `/ai/tasks/${task.id.toString()}` }] : []),
            ],
        };
    });

    const sessionItems = relatedSessions.slice(0, 8).map((session) => {
        const linkedRun = session.runId !== NONE_U64
            ? relatedRuns.find((run) => run.id === session.runId) ?? null
            : null;
        return {
            key: session.id.toString(),
            title: session.summary || humanizeRuntimeToken(session.adapterType),
            subtitle: `${humanizeRuntimeToken(session.status)} • ${session.externalSessionId}`,
            meta: `Last seen ${session.lastSeenAt !== NONE_U64 ? formatRelativeTime(session.lastSeenAt) : 'not recorded'}${session.metadataJson && session.metadataJson !== '{}' ? ` • ${session.metadataJson}` : ''}`,
            badges: [
                { label: humanizeRuntimeToken(session.adapterType), tone: 'info' as const },
                { label: humanizeRuntimeToken(session.status), tone: session.status === 'active' ? 'success' as const : session.status === 'failed' ? 'danger' as const : 'neutral' as const },
            ],
            actions: linkedRun && linkedRun.taskId !== NONE_U64
                ? [{ label: 'Open run task', href: `/ai/tasks/${linkedRun.taskId.toString()}` }]
                : [],
        };
    });

    const runItems = relatedRuns.slice(0, 8).map((run) => ({
        key: run.id.toString(),
        title: run.summary || `${humanizeRuntimeToken(run.status)} run`,
        subtitle: `${humanizeRuntimeToken(run.triggerType)} • ${formatBigIntDateTime(run.createdAt)}`,
        meta: `${formatUsd(microusdToUsd(run.costMicrousd))} • ${run.toolCalls.toString()} tool call${run.toolCalls === 1n ? '' : 's'}${run.errorMessage ? ` • ${run.errorMessage}` : ''}`,
        badges: [
            { label: humanizeRuntimeToken(run.status), tone: run.status === 'completed' ? 'success' as const : run.status === 'failed' ? 'danger' as const : run.status === 'waiting_approval' ? 'warning' as const : 'info' as const },
            { label: `${run.tokenInput.toString()} in / ${run.tokenOutput.toString()} out`, tone: 'neutral' as const },
        ],
        actions: run.taskId !== NONE_U64
            ? [{ label: 'Open task', href: `/ai/tasks/${run.taskId.toString()}` }]
            : [],
    }));

    const eventItems = relatedRunEvents.slice(0, 10).map((event) => ({
        key: event.id.toString(),
        title: event.message,
        subtitle: `${humanizeRuntimeToken(event.eventType)} • ${formatBigIntDateTime(event.createdAt)}`,
        meta: event.payloadJson && event.payloadJson !== '{}'
            ? event.payloadJson
            : 'No additional payload recorded.',
        badges: [
            { label: humanizeRuntimeToken(event.level), tone: event.level === 'error' ? 'danger' as const : event.level === 'warning' ? 'warning' as const : 'info' as const },
            ...(event.runId !== NONE_U64 ? [{ label: 'run', tone: 'neutral' as const }] : []),
            ...(event.taskId !== NONE_U64 ? [{ label: 'task', tone: 'neutral' as const }] : []),
        ],
        actions: event.taskId !== NONE_U64
            ? [{ label: 'Open task', href: `/ai/tasks/${event.taskId.toString()}` }]
            : [],
    }));

    const handleStatusChange = async (status: 'active' | 'paused') => {
        if (!agent) return;
        try {
            await updateAiAgentStatus({ agentId: agent.id, status });
            toast.success(status === 'active' ? 'Agent activated' : 'Agent paused');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update agent');
        }
    };

    const doSaveRuntime = async (configOverride?: Record<string, unknown>) => {
        if (!agent || currentOrgId == null) return;
        try {
            setSavingRuntime(true);
            await upsertAiAgentRuntime({
                orgId: currentOrgId,
                agentId: agent.id,
                adapterType: runtimeForm.adapterType,
                runtimeStatus: runtimeForm.runtimeStatus,
                baseUrl: runtimeForm.baseUrl.trim(),
                command: runtimeForm.command.trim(),
                cwd: runtimeForm.cwd.trim(),
                envJson: runtimeForm.envJson.trim() || '{}',
                configJson: JSON.stringify(configOverride ?? adapterConfig),
                heartbeatPolicyJson: runtimeForm.heartbeatPolicyJson.trim() || '{}',
                wakePolicyJson: runtimeForm.wakePolicyJson.trim() || '{}',
            });
            toast.success('Runtime configuration saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save runtime configuration');
        } finally {
            setSavingRuntime(false);
        }
    };

    const handleSaveRuntime = (event: React.FormEvent) => {
        event.preventDefault();
        void doSaveRuntime();
    };

    const handleQueueWakeup = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!agent || currentOrgId == null) return;
        try {
            setQueueingWakeup(true);
            await enqueueAiWakeupRequest({
                orgId: currentOrgId,
                agentId: agent.id,
                taskId: BigInt(wakeupForm.taskId),
                source: wakeupForm.source,
                reason: wakeupForm.reason.trim() || `Wake ${agent.name}`,
                payloadJson: wakeupForm.payloadJson.trim() || '{}',
            });
            setWakeupForm((current) => ({
                ...current,
                reason: '',
                payloadJson: '{}',
            }));
            toast.success('Wakeup queued');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to queue wakeup');
        } finally {
            setQueueingWakeup(false);
        }
    };

    const handleRestoreRuntimeRevision = async (revisionId: bigint) => {
        try {
            setRestoringRevisionId(revisionId);
            await restoreAiAgentRuntimeRevision({ revisionId });
            toast.success('Runtime configuration restored');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to restore runtime configuration');
        } finally {
            setRestoringRevisionId(null);
        }
    };

    if (!agent) {
        return (
            <AIWorkspacePage page="agents">
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Button component={Link} to="/ai/agents" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0.5 }}>
                        ← Agents
                    </Button>
                </Stack>
                <Typography variant="body2" sx={{ color: '#555' }}>Agent not found.</Typography>
            </AIWorkspacePage>
        );
    }

    return (
        <AIWorkspacePage page="agents">
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.5}>
                    <Button component={Link} to="/ai/agents" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0, alignSelf: 'flex-start' }}>
                        ← Agents
                    </Button>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{agent.name}</Typography>
                        <AIStatusPill label={agent.status} tone={agent.status === 'active' ? 'success' : agent.status === 'attention' ? 'warning' : 'neutral'} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        {agent.role} • {agent.department}
                        {owner ? ` • ${owner.name || owner.email}` : ''}
                        {project ? ` • ${project.name}` : ''}
                        {liveRuns.length > 0 ? ` • ${liveRuns.length} live run${liveRuns.length !== 1 ? 's' : ''}` : ''}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexShrink={0}>
                    {agent.status === 'active' ? (
                        <Button variant="outlined" size="small" sx={{ textTransform: 'none' }} onClick={() => handleStatusChange('paused')}>Pause</Button>
                    ) : (
                        <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={() => handleStatusChange('active')}>Activate</Button>
                    )}
                </Stack>
            </Stack>

            <Stack spacing={2}>
                <AISectionCard eyebrow="Profile" title="Agent profile" description="Assignment, ownership, and control settings.">
                    <Stack spacing={1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>{agent.role}</Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>{agent.department}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <AIStatusPill label={agent.status} tone={agent.status === 'active' ? 'success' : 'neutral'} />
                            <AIStatusPill label={agent.autonomyMode} tone="info" />
                            <AIStatusPill label={agent.approvalMode} tone="warning" />
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Created {formatBigIntDateTime(agent.createdAt)} • Updated {formatBigIntDateTime(agent.updatedAt)}
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AIRuntimeSlotsCard
                    eyebrow="Runtime"
                    title="Runtime overview"
                    description="Live runtime state, fallback posture, wake cadence, and adapter coverage for this agent."
                    slots={runtimeSlots}
                    badges={runtimeBadges}
                    footer="Runtime records, adapter sessions, and wakeups are now part of the AI control plane. This card reads from those live rows instead of placeholder copy."
                />

                <AISectionCard eyebrow="Runtime controls" title="Attach or update runtime" description="Owners can map this agent to a manual lane, a local process, or an HTTP adapter.">
                    <Stack component="form" spacing={1.2} onSubmit={handleSaveRuntime}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Adapter type"
                                value={runtimeForm.adapterType}
                                onChange={(event) => {
                                    setRuntimeForm((current) => ({ ...current, adapterType: event.target.value }));
                                    setAdapterConfig({});
                                }}
                                sx={{ minWidth: 200 }}
                            >
                                {runtimeAdapterOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Runtime status"
                                value={runtimeForm.runtimeStatus}
                                onChange={(event) => setRuntimeForm((current) => ({ ...current, runtimeStatus: event.target.value }))}
                                sx={{ minWidth: 180 }}
                            >
                                {runtimeStatusOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {humanizeRuntimeToken(option)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <TextField
                            size="small"
                            label="Base URL"
                            value={runtimeForm.baseUrl}
                            onChange={(event) => setRuntimeForm((current) => ({ ...current, baseUrl: event.target.value }))}
                            placeholder="http://localhost:4310"
                        />
                        <TextField
                            size="small"
                            label="Command"
                            value={runtimeForm.command}
                            onChange={(event) => setRuntimeForm((current) => ({ ...current, command: event.target.value }))}
                            placeholder="bun run ai:worker"
                        />
                        <TextField
                            size="small"
                            label="Working directory"
                            value={runtimeForm.cwd}
                            onChange={(event) => setRuntimeForm((current) => ({ ...current, cwd: event.target.value }))}
                            placeholder="/srv/timey/agents"
                        />
                        {runtimeForm.adapterType !== 'manual' && (
                            <AdapterConfigForm
                                adapterType={runtimeForm.adapterType as AdapterType}
                                config={adapterConfig}
                                onChange={setAdapterConfig}
                                onSave={() => void doSaveRuntime()}
                                saving={savingRuntime}
                                disabled={!isOwner || currentOrgId == null}
                            />
                        )}
                        <TextField
                            size="small"
                            label="Environment JSON"
                            value={runtimeForm.envJson}
                            onChange={(event) => setRuntimeForm((current) => ({ ...current, envJson: event.target.value }))}
                            multiline
                            minRows={3}
                            fullWidth
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                size="small"
                                label="Heartbeat policy JSON"
                                value={runtimeForm.heartbeatPolicyJson}
                                onChange={(event) => setRuntimeForm((current) => ({ ...current, heartbeatPolicyJson: event.target.value }))}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                            <TextField
                                size="small"
                                label="Wake policy JSON"
                                value={runtimeForm.wakePolicyJson}
                                onChange={(event) => setRuntimeForm((current) => ({ ...current, wakePolicyJson: event.target.value }))}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                {isOwner ? 'Only owners can change runtime configuration.' : 'You need owner access to edit runtime configuration.'}
                            </Typography>
                            <Button type="submit" variant="contained" disabled={!isOwner || currentOrgId == null || savingRuntime} sx={{ textTransform: 'none' }}>
                                Save runtime
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Tools" title="Allowed tools" description="Parsed from the current tool allowlist.">
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {tools.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No tools assigned yet.
                            </Typography>
                        ) : tools.map((tool) => (
                            <AIStatusPill key={tool} label={tool} tone="info" />
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Wake agent" title="Queue a wakeup" description="Push this agent into the runtime queue with or without a linked task.">
                    <Stack component="form" spacing={1.2} onSubmit={handleQueueWakeup}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Linked task"
                                value={wakeupForm.taskId}
                                onChange={(event) => setWakeupForm((current) => ({ ...current, taskId: event.target.value }))}
                                sx={{ minWidth: 220 }}
                            >
                                <MenuItem value="0">No linked task</MenuItem>
                                {relatedTasks.map((task) => (
                                    <MenuItem key={task.id.toString()} value={task.id.toString()}>
                                        {task.title}
                                    </MenuItem>
                                ))}
                            </TextField>
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
                        </Stack>
                        <TextField
                            size="small"
                            label="Reason"
                            value={wakeupForm.reason}
                            onChange={(event) => setWakeupForm((current) => ({ ...current, reason: event.target.value }))}
                            placeholder="Run the proposal refresh for the latest task."
                        />
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
                                Open wakeups are merged at the reducer level when the same task/source pair is already queued.
                            </Typography>
                            <Button type="submit" variant="outlined" disabled={currentOrgId == null || queueingWakeup} sx={{ textTransform: 'none' }}>
                                Queue wakeup
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AIRuntimeListCard
                    eyebrow="Wakeups"
                    title="Wakeup queue"
                    description="Actual queued, claimed, running, completed, and failed wakeups for this agent."
                    items={wakeupItems}
                    emptyMessage="No wakeups have been recorded for this agent yet."
                />

                <AIRuntimeListCard
                    eyebrow="Sessions"
                    title="Adapter sessions"
                    description="External runtime session records tied to this agent."
                    items={sessionItems}
                    emptyMessage="No adapter sessions have been recorded for this agent yet."
                />

                <AIRuntimeListCard
                    eyebrow="Runs"
                    title="Recent execution runs"
                    description="Latest run records for this agent, including trigger path, cost, and task links."
                    items={runItems}
                    emptyMessage="No execution runs have been recorded for this agent yet."
                />

                <AIRuntimeListCard
                    eyebrow="Events"
                    title="Run event timeline"
                    description="Detailed runtime events emitted by the execution layer for this agent."
                    items={eventItems}
                    emptyMessage="No run events have been recorded for this agent yet."
                />

                <AIRevisionHistoryCard
                    eyebrow="Config history"
                    title="Runtime revisions"
                    description="Every runtime save and restore now creates a recoverable revision so operators can roll the adapter back cleanly."
                    revisions={runtimeRevisions}
                    emptyMessage="No runtime revisions have been recorded for this agent yet."
                    usersById={usersById}
                    summarizeRevision={summarizeRuntimeRevision}
                    badgesForRevision={badgesForRuntimeRevision}
                    onRestore={isOwner ? handleRestoreRuntimeRevision : undefined}
                    restoringRevisionId={restoringRevisionId}
                    canRestore={isOwner}
                />
            </Stack>
        </AIWorkspacePage>
    );
}

export const AiAgentDetailPage = AIAgentDetailPage;
