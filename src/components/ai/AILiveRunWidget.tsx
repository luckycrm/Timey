import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {
    AiAdapterSession,
    AiAgent,
    AiAgentRuntime,
    AiRun,
    AiRunEvent,
    AiTask,
    AiWakeupRequest,
    AiWorkspaceSettings,
} from '../../module_bindings/types';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import { AIProgressRow, AISectionCard, AIStatusPill } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, formatUsd, microusdToUsd, NONE_U64 } from './aiUtils';
import { humanizeRuntimeToken } from './AIRuntimeDetailBlocks';

interface AILiveRunWidgetProps {
    task: AiTask;
    agent: AiAgent | null;
    runtime: AiAgentRuntime | null;
    activeRun: AiRun | null;
    latestRun: AiRun | null;
    wakeups: AiWakeupRequest[];
    adapterSessions: AiAdapterSession[];
    runEvents: AiRunEvent[];
    aiSettings: AiWorkspaceSettings | null;
    pendingApprovalTitle?: string | null;
    actionSlot?: ReactNode;
}

const runStatusProgress: Record<string, number> = {
    queued: 18,
    running: 62,
    waiting_approval: 84,
    completed: 100,
    failed: 100,
    cancelled: 100,
};

function toneForStatus(status: string) {
    if (status === 'completed' || status === 'ready' || status === 'active') return 'success' as const;
    if (status === 'failed' || status === 'cancelled' || status === 'error') return 'danger' as const;
    if (status === 'waiting_approval' || status === 'queued' || status === 'claimed') return 'warning' as const;
    return 'info' as const;
}

export function AILiveRunWidget({
    task,
    agent,
    runtime,
    activeRun,
    latestRun,
    wakeups,
    adapterSessions,
    runEvents,
    aiSettings,
    pendingApprovalTitle = null,
    actionSlot,
}: AILiveRunWidgetProps) {
    const visibleRun = activeRun ?? latestRun;
    const visibleRunEvents = visibleRun
        ? runEvents.filter((event) => event.runId === visibleRun.id).slice(0, 5)
        : runEvents.slice(0, 5);
    const latestSession = visibleRun
        ? adapterSessions.find((session) => session.runId === visibleRun.id) ?? adapterSessions[0] ?? null
        : adapterSessions[0] ?? null;
    const latestWakeup = visibleRun
        ? wakeups.find((wakeup) => wakeup.runId === visibleRun.id) ?? wakeups[0] ?? null
        : wakeups[0] ?? null;

    const stageProgress = visibleRun ? (runStatusProgress[visibleRun.status] ?? 0) : 0;
    const maxRunCostUsd = aiSettings ? microusdToUsd(aiSettings.maxRunCostMicrousd) : 0;
    const costProgress = visibleRun && maxRunCostUsd > 0
        ? Math.min(100, Math.round((microusdToUsd(visibleRun.costMicrousd) / maxRunCostUsd) * 100))
        : 0;

    return (
        <AISectionCard
            eyebrow="Live execution"
            title={visibleRun ? 'Current run and operator lane' : 'Task execution is idle'}
            description={
                visibleRun
                    ? 'This widget combines the active run, the latest wakeup, the adapter session, and the freshest runtime events for the current task.'
                    : 'No live run exists right now. The widget still shows the most recent wakeup and any task-scoped runtime records.'
            }
            actionSlot={actionSlot}
        >
            <Stack spacing={1.6}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <AIStatusPill
                        label={visibleRun ? humanizeRuntimeToken(visibleRun.status) : 'No live run'}
                        tone={visibleRun ? toneForStatus(visibleRun.status) : 'neutral'}
                    />
                    <AIStatusPill
                        label={humanizeRuntimeToken(task.status)}
                        tone={toneForStatus(task.status)}
                    />
                    {visibleRun ? (
                        <AIStatusPill
                            label={humanizeRuntimeToken(visibleRun.triggerType)}
                            tone="info"
                        />
                    ) : null}
                    {runtime ? (
                        <AIStatusPill
                            label={`${humanizeRuntimeToken(runtime.adapterType)} adapter`}
                            tone={toneForStatus(runtime.runtimeStatus)}
                        />
                    ) : (
                        <AIStatusPill label="Manual lane" tone="warning" />
                    )}
                </Stack>

                {pendingApprovalTitle ? (
                    <Box
                        sx={{
                            px: 1.5,
                            py: 1.25,
                            borderRadius: appRadii.card,
                            border: '1px solid rgba(255,152,0,0.28)',
                            bgcolor: 'rgba(255,152,0,0.08)',
                        }}
                    >
                        <Typography variant="caption" sx={{ color: '#ffc47b', fontWeight: 700 }}>
                            Approval waiting
                        </Typography>
                        <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.65, mt: 0.35 }}>
                            {pendingApprovalTitle}
                        </Typography>
                    </Box>
                ) : null}

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
                    <Stack spacing={1.15} sx={{ flex: 1 }}>
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.35,
                                borderRadius: appRadii.card,
                                border: `1px solid ${chatColors.border}`,
                                bgcolor: 'rgba(255,255,255,0.015)',
                            }}
                        >
                            <Stack spacing={0.6}>
                                <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
                                    Assigned agent
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {agent?.name || 'Not assigned'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                    {runtime
                                        ? `${humanizeRuntimeToken(runtime.runtimeStatus)} • last heartbeat ${runtime.lastHeartbeatAt !== NONE_U64 ? formatRelativeTime(runtime.lastHeartbeatAt) : 'not recorded'}`
                                        : 'This task is still waiting for a configured runtime.'}
                                </Typography>
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.35,
                                borderRadius: appRadii.card,
                                border: `1px solid ${chatColors.border}`,
                                bgcolor: 'rgba(255,255,255,0.015)',
                            }}
                        >
                            <Stack spacing={0.6}>
                                <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
                                    Latest wakeup
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {latestWakeup ? latestWakeup.reason || humanizeRuntimeToken(latestWakeup.source) : 'No wakeup queued yet'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                    {latestWakeup
                                        ? `${humanizeRuntimeToken(latestWakeup.status)} • ${formatBigIntDateTime(latestWakeup.createdAt)}`
                                        : 'Wakeups will appear here once the task is queued or resumed.'}
                                </Typography>
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.35,
                                borderRadius: appRadii.card,
                                border: `1px solid ${chatColors.border}`,
                                bgcolor: 'rgba(255,255,255,0.015)',
                            }}
                        >
                            <Stack spacing={0.6}>
                                <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
                                    Latest adapter session
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {latestSession ? latestSession.summary || latestSession.externalSessionId : 'No session yet'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                    {latestSession
                                        ? `${humanizeRuntimeToken(latestSession.status)} • last seen ${latestSession.lastSeenAt !== NONE_U64 ? formatRelativeTime(latestSession.lastSeenAt) : 'not recorded'}`
                                        : 'Session state appears here once the adapter reports it.'}
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>

                    <Stack spacing={1.3} sx={{ flex: 1 }}>
                        <AIProgressRow
                            label="Run stage"
                            value={stageProgress}
                            detail={visibleRun ? humanizeRuntimeToken(visibleRun.status) : 'idle'}
                            tone={visibleRun ? toneForStatus(visibleRun.status) : 'neutral'}
                        />
                        <AIProgressRow
                            label="Cost guardrail"
                            value={costProgress}
                            detail={visibleRun
                                ? `${formatUsd(microusdToUsd(visibleRun.costMicrousd))}${maxRunCostUsd > 0 ? ` of ${formatUsd(maxRunCostUsd)}` : ''}`
                                : 'No spend yet'}
                            tone={visibleRun && maxRunCostUsd > 0 && costProgress >= 80 ? 'warning' : 'info'}
                        />
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.35,
                                borderRadius: appRadii.card,
                                border: `1px solid ${chatColors.border}`,
                                bgcolor: 'rgba(255,255,255,0.015)',
                            }}
                        >
                            <Stack spacing={0.45}>
                                <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
                                    Current run summary
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {visibleRun?.summary || 'No summary recorded yet'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                    {visibleRun
                                        ? `${visibleRun.toolCalls.toString()} tool call${visibleRun.toolCalls === 1n ? '' : 's'} • started ${formatBigIntDateTime(visibleRun.createdAt)}`
                                        : 'Start the task or queue a wakeup to create a run.'}
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Stack>

                <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                        Latest execution signals
                    </Typography>
                    {visibleRunEvents.length === 0 ? (
                        <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                            No run events have been recorded for the current task yet.
                        </Typography>
                    ) : (
                        visibleRunEvents.map((event) => (
                            <Box
                                key={event.id.toString()}
                                sx={{
                                    px: 1.4,
                                    py: 1.2,
                                    borderRadius: appRadii.card,
                                    border: `1px solid ${chatColors.border}`,
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: 'flex-start', md: 'center' }}
                                >
                                    <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {event.message}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                            {humanizeRuntimeToken(event.eventType)} • {formatBigIntDateTime(event.createdAt)}
                                        </Typography>
                                    </Stack>
                                    <AIStatusPill label={humanizeRuntimeToken(event.level)} tone={toneForStatus(event.level)} />
                                </Stack>
                            </Box>
                        ))
                    )}
                </Stack>
            </Stack>
        </AISectionCard>
    );
}
