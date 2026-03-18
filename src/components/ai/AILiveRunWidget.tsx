import { useMemo, useRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TerminalIcon from '@mui/icons-material/Terminal';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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

const MAX_FEED_ITEMS = 80;
const TOOL_CALL_TYPES = new Set(['tool_call', 'tool_result', 'tool_error']);

function EventLevelIcon({ level }: { level: string }) {
    if (level === 'error') return <ErrorOutlineIcon sx={{ fontSize: 14, color: '#f87171', flexShrink: 0 }} />;
    if (level === 'warning') return <ErrorOutlineIcon sx={{ fontSize: 14, color: '#fbbf24', flexShrink: 0 }} />;
    if (level === 'info') return <InfoOutlinedIcon sx={{ fontSize: 14, color: '#60a5fa', flexShrink: 0 }} />;
    return <TerminalIcon sx={{ fontSize: 14, color: '#6b7280', flexShrink: 0 }} />;
}

function ToolCallBlock({ event }: { event: AiRunEvent }) {
    const [open, setOpen] = useState(false);
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(event.payloadJson) as Record<string, unknown>; } catch { /* ok */ }

    return (
        <Box sx={{ borderLeft: '2px solid rgba(116,167,255,0.3)', pl: 1.2, py: 0.5 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
                <TerminalIcon sx={{ fontSize: 13, color: '#7eb0ff', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#b9d1ff', fontWeight: 600, fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.message}
                </Typography>
                {parsed && (
                    <Tooltip title={open ? 'Collapse' : 'Expand payload'}>
                        <IconButton size="small" onClick={() => setOpen((v) => !v)} sx={{ p: 0.25, color: '#555' }}>
                            {open ? <ExpandLessIcon sx={{ fontSize: 13 }} /> : <ExpandMoreIcon sx={{ fontSize: 13 }} />}
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
            {parsed && (
                <Collapse in={open}>
                    <Box sx={{ mt: 0.75, p: 1, borderRadius: '8px', bgcolor: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '11px', color: '#9ca3af', overflowX: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(parsed, null, 2)}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
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
    const feedRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);

    const visibleRun = activeRun ?? latestRun;

    const visibleRunEvents = useMemo(() => {
        const base = visibleRun
            ? runEvents.filter((event) => event.runId === visibleRun.id)
            : runEvents;
        return [...base]
            .sort((a, b) => Number(a.createdAt - b.createdAt))
            .slice(-MAX_FEED_ITEMS);
    }, [visibleRun, runEvents]);

    // Auto-scroll to bottom when new events arrive and feed is expanded
    useEffect(() => {
        if (expanded && feedRef.current) {
            const el = feedRef.current;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (atBottom) el.scrollTop = el.scrollHeight;
        }
    }, [visibleRunEvents.length, expanded]);

    const previewEvents = expanded ? visibleRunEvents : visibleRunEvents.slice(-5);
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

                {/* ── Execution transcript ── */}
                <Box
                    sx={{
                        borderRadius: appRadii.card,
                        border: `1px solid ${chatColors.border}`,
                        bgcolor: 'rgba(0,0,0,0.25)',
                        overflow: 'hidden',
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.4, py: 1, borderBottom: `1px solid ${chatColors.border}` }}
                    >
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <TerminalIcon sx={{ fontSize: 14, color: '#7eb0ff' }} />
                            <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Execution transcript
                            </Typography>
                            {visibleRunEvents.length > 0 && (
                                <Typography variant="caption" sx={{ color: '#555', ml: 0.5 }}>
                                    {visibleRunEvents.length} event{visibleRunEvents.length === 1 ? '' : 's'}
                                </Typography>
                            )}
                        </Stack>
                        {visibleRunEvents.length > 5 && (
                            <Tooltip title={expanded ? 'Show less' : 'Show all events'}>
                                <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ p: 0.5, color: '#555' }}>
                                    {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    <Box
                        ref={feedRef}
                        sx={{
                            maxHeight: expanded ? 420 : 'none',
                            overflowY: expanded ? 'auto' : 'visible',
                            p: 1.2,
                        }}
                    >
                        {visibleRunEvents.length === 0 ? (
                            <Typography variant="body2" sx={{ color: chatColors.textMuted, lineHeight: 1.7, py: 0.5 }}>
                                No run events recorded yet. Start the task to see execution signals here.
                            </Typography>
                        ) : (
                            <Stack spacing={0.6}>
                                {previewEvents.map((event) => (
                                    TOOL_CALL_TYPES.has(event.eventType) ? (
                                        <ToolCallBlock key={event.id.toString()} event={event} />
                                    ) : (
                                        <Stack key={event.id.toString()} direction="row" spacing={0.75} alignItems="flex-start">
                                            <Box sx={{ pt: '2px' }}>
                                                <EventLevelIcon level={event.level} />
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="caption" sx={{ color: event.level === 'error' ? '#f87171' : event.level === 'warning' ? '#fbbf24' : '#d1d5db', lineHeight: 1.55, display: 'block', wordBreak: 'break-word' }}>
                                                    {event.message}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '10px' }}>
                                                    {humanizeRuntimeToken(event.eventType)} · {formatBigIntDateTime(event.createdAt)}
                                                </Typography>
                                            </Box>
                                            {event.level === 'error' ? (
                                                <AIStatusPill label="error" tone="danger" />
                                            ) : event.level === 'warning' ? (
                                                <AIStatusPill label="warn" tone="warning" />
                                            ) : null}
                                        </Stack>
                                    )
                                ))}
                                {!expanded && visibleRunEvents.length > 5 && (
                                    <Typography
                                        variant="caption"
                                        onClick={() => setExpanded(true)}
                                        sx={{ color: '#7eb0ff', cursor: 'pointer', pt: 0.5, '&:hover': { textDecoration: 'underline' } }}
                                    >
                                        + {visibleRunEvents.length - 5} more events — click to expand
                                    </Typography>
                                )}
                            </Stack>
                        )}
                    </Box>
                </Box>
            </Stack>
        </AISectionCard>
    );
}
