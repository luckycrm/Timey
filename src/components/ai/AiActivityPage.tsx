import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, NONE_U64 } from './aiUtils';
import { humanizeRuntimeToken } from './AIRuntimeDetailBlocks';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIActivityPage() {
    const {
        aiActivities,
        aiAgents,
        aiApprovals,
        aiRunEvents,
        aiRuns,
        aiTasks,
        usersById,
    } = useAIWorkspaceData();

    const now = Date.now();
    const recentActivity = [...aiActivities]
        .sort((left, right) => Number(right.createdAt - left.createdAt));
    const recentRunEvents = [...aiRunEvents]
        .sort((left, right) => Number(right.createdAt - left.createdAt));
    const combinedFeed = [
        ...recentActivity.map((event) => ({
            key: `activity-${event.id.toString()}`,
            createdAt: event.createdAt,
            source: 'activity' as const,
            title: event.description,
            subtitle: humanizeRuntimeToken(event.eventType),
            actorLabel: usersById.get(event.actorUserId)?.name || usersById.get(event.actorUserId)?.email || 'System',
            agentName: aiAgents.find((row) => row.id === event.agentId)?.name || '',
            rawPayload: event.metadataJson,
        })),
        ...recentRunEvents.map((event) => ({
            key: `run-event-${event.id.toString()}`,
            createdAt: event.createdAt,
            source: 'run_event' as const,
            title: event.message,
            subtitle: `${humanizeRuntimeToken(event.eventType)} • ${humanizeRuntimeToken(event.level)}`,
            actorLabel: usersById.get(event.actorUserId)?.name || usersById.get(event.actorUserId)?.email || 'Runtime',
            agentName: aiAgents.find((row) => row.id === event.agentId)?.name || '',
            rawPayload: event.payloadJson,
        })),
    ].sort((left, right) => Number(right.createdAt - left.createdAt));

    const last24h = recentActivity.filter((event) => Number(event.createdAt) >= now - 24 * 60 * 60 * 1000);
    const last24hRunEvents = recentRunEvents.filter((event) => Number(event.createdAt) >= now - 24 * 60 * 60 * 1000);

    return (
        <AIWorkspacePage page="activity">
            <AIPageIntro
                eyebrow="Activity"
                title="Read the AI audit stream"
                description="Every create, status change, approval decision, and run update writes into one activity feed. This page is the operator audit layer."
            />

            <AIStatGrid>
                <AIStatCard label="Workspace events today" value={String(last24h.length)} caption="Across the last 24 hours" tone="info" />
                <AIStatCard label="Run events today" value={String(last24hRunEvents.length)} caption={`${recentRunEvents.length} detailed run events recorded`} tone="success" />
                <AIStatCard label="Approval events" value={String(recentActivity.filter((event) => event.approvalId !== NONE_U64).length)} caption={`${aiApprovals.filter((approval) => approval.status === 'pending').length} still pending`} tone="warning" />
                <AIStatCard label="Task events" value={String(recentActivity.filter((event) => event.taskId !== NONE_U64).length)} caption={`${aiTasks.length} tasks currently tracked`} tone="neutral" />
                <AIStatCard label="Runs tracked" value={String(aiRuns.length)} caption={`${recentActivity.filter((event) => event.runId !== NONE_U64).length} workspace activity rows mention a run`} tone="info" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Feed" title="Combined operator feed" description="Workspace activity plus low-level run events, sorted into one timeline.">
                    <Stack spacing={1.2}>
                        {combinedFeed.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No AI activity has been recorded yet.
                            </Typography>
                        ) : combinedFeed.slice(0, 14).map((event) => {
                            return (
                                <Stack
                                    key={event.key}
                                    direction={{ xs: 'column', md: 'row' }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    sx={{
                                        px: 1.6,
                                        py: 1.4,
                                        borderRadius: '14px',
                                        border: '1px solid #1a1a1a',
                                        bgcolor: 'rgba(255,255,255,0.015)',
                                    }}
                                >
                                    <Stack spacing={0.45}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {event.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                            {event.source === 'run_event' ? 'Run event' : 'Workspace event'} • {event.subtitle} • {event.actorLabel}{event.agentName ? ` • ${event.agentName}` : ''}
                                        </Typography>
                                        {event.rawPayload && event.rawPayload !== '{}' ? (
                                            <Typography variant="caption" sx={{ color: '#666666' }}>
                                                {event.rawPayload}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {formatRelativeTime(event.createdAt, now)}
                                    </Typography>
                                </Stack>
                            );
                        })}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Patterns" title="Recent event mix" description="A quick read on what kind of activity the workspace is generating.">
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {recentActivity.filter((event) => event.eventType.includes('created')).length} creation events have been logged.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {recentActivity.filter((event) => event.eventType.includes('status') || event.eventType.includes('updated')).length} status or update events have been logged.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            {recentActivity.filter((event) => event.eventType.includes('approval')).length} approval-related events are in the feed.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            {recentRunEvents.filter((event) => event.level === 'error' || event.level === 'warning').length} run events were recorded at warning or error level.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Attention" title="Watch items" description="Short guidance derived from the current feed and pending state.">
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {aiApprovals.filter((approval) => approval.status === 'pending').length} approvals are still waiting.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {aiRuns.filter((run) => run.status === 'failed').length} runs have failed and may need retry logic.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Last event at {recentActivity[0] ? formatBigIntDateTime(recentActivity[0].createdAt) : 'not available'}.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Export" title="Audit posture" description="This feed is already structured enough to back exports later.">
                    <Stack spacing={1}>
                        <AIStatusPill label="Append-only events" tone="success" />
                        <AIStatusPill label="Detailed run log rows" tone="info" />
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            Reducers write coarse workspace activity rows and operators/runtime can append detailed run events. That gives the AI console a usable audit base before full Paperclip-style streaming logs land.
                        </Typography>
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiActivityPage = AIActivityPage;
