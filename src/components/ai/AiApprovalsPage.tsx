import { useMemo } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIApprovalsPage() {
    const {
        aiApprovals,
        aiTasks,
        aiAgents,
        usersById,
    } = useAIWorkspaceData();

    const decideAiApproval = useReducer(reducers.decideAiApproval);

    const now = Date.now();

    const approvalsWithContext = useMemo(
        () => aiApprovals
            .map((approval) => ({
                approval,
                task: aiTasks.find((task) => task.id === approval.taskId) ?? null,
                agent: aiAgents.find((agent) => agent.id === approval.agentId) ?? null,
                requester: usersById.get(approval.requesterUserId) ?? null,
                reviewer: approval.reviewerUserId !== NONE_U64 ? usersById.get(approval.reviewerUserId) ?? null : null,
            }))
            .sort((left, right) => Number(right.approval.createdAt - left.approval.createdAt)),
        [aiAgents, aiApprovals, aiTasks, usersById]
    );

    const pendingApprovals = approvalsWithContext.filter((row) => row.approval.status === 'pending');
    const resolvedToday = approvalsWithContext.filter((row) =>
        row.approval.status !== 'pending' &&
        row.approval.decidedAt !== NONE_U64 &&
        new Date(Number(row.approval.decidedAt)).toDateString() === new Date(now).toDateString()
    );
    const approvedToday = resolvedToday.filter((row) => row.approval.status === 'approved').length;
    const rejectedToday = resolvedToday.filter((row) => row.approval.status === 'rejected').length;
    const oldestPending = pendingApprovals.length === 0
        ? null
        : pendingApprovals[pendingApprovals.length - 1]?.approval.createdAt ?? null;

    const riskCounts = useMemo(() => {
        const pending = pendingApprovals.length || 1;
        const highRisk = pendingApprovals.filter((row) => row.approval.riskLevel === 'high' || row.approval.riskLevel === 'critical').length;
        const mediumRisk = pendingApprovals.filter((row) => row.approval.riskLevel === 'medium').length;
        const lowRisk = pendingApprovals.filter((row) => row.approval.riskLevel === 'low').length;
        return {
            high: Math.round((highRisk / pending) * 100),
            medium: Math.round((mediumRisk / pending) * 100),
            low: Math.round((lowRisk / pending) * 100),
        };
    }, [pendingApprovals]);

    const handleDecision = async (approvalId: bigint, status: 'approved' | 'rejected') => {
        try {
            await decideAiApproval({ approvalId, status });
            toast.success(status === 'approved' ? 'Approval granted' : 'Approval rejected');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update approval');
        }
    };

    return (
        <AIWorkspacePage page="approvals">
            <AIPageIntro
                eyebrow="Approvals"
                title="Decide what can move forward"
                description="Approvals are now live workspace records. Review the pending queue, decide directly here, and keep the task board unblocked."
            />

            <AIStatGrid>
                <AIStatCard label="Pending" value={String(pendingApprovals.length)} caption={oldestPending ? `Oldest request ${formatRelativeTime(oldestPending, now)}` : 'No queue right now'} tone="warning" />
                <AIStatCard label="Resolved today" value={String(resolvedToday.length)} caption={`${approvedToday} approved, ${rejectedToday} rejected`} tone="success" />
                <AIStatCard label="High risk" value={String(pendingApprovals.filter((row) => row.approval.riskLevel === 'high' || row.approval.riskLevel === 'critical').length)} caption="Requests that should be reviewed first" tone="danger" />
                <AIStatCard label="Waiting on reviewers" value={String(aiTasks.filter((task) => task.status === 'waiting_approval').length)} caption="Tasks currently blocked by approval state" tone="info" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard
                    eyebrow="Queue"
                    title="Pending approval requests"
                    description="Approve or reject directly here. The linked task status updates with the decision."
                >
                    <Stack spacing={1.2}>
                        {pendingApprovals.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No approvals are waiting right now.
                            </Typography>
                        ) : pendingApprovals.map(({ approval, task, agent, requester }) => (
                            <Stack
                                key={approval.id.toString()}
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
                                            {approval.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                            {task?.title || 'No task linked'} • {agent?.name || 'No agent linked'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            Requested by {requester?.name || requester?.email || 'Unknown'} • {formatRelativeTime(approval.createdAt, now)}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <AIStatusPill label={approval.riskLevel} tone={approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 'danger' : approval.riskLevel === 'medium' ? 'warning' : 'info'} />
                                        <AIStatusPill label={approval.status} tone="warning" />
                                    </Stack>
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                    {approval.summary || 'No approval summary provided.'}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        href={`/ai/approvals/${approval.id.toString()}`}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Details
                                    </Button>
                                    <Button size="small" variant="contained" sx={{ textTransform: 'none' }} onClick={() => handleDecision(approval.id, 'approved')}>
                                        Approve
                                    </Button>
                                    <Button size="small" variant="outlined" color="error" sx={{ textTransform: 'none' }} onClick={() => handleDecision(approval.id, 'rejected')}>
                                        Reject
                                    </Button>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Mix"
                    title="Risk distribution"
                    description="The current queue split by declared risk level."
                >
                    <Stack spacing={1.6}>
                        <AIProgressRow label="High risk" value={riskCounts.high} detail={`${pendingApprovals.filter((row) => row.approval.riskLevel === 'high' || row.approval.riskLevel === 'critical').length} requests`} tone="danger" />
                        <AIProgressRow label="Medium risk" value={riskCounts.medium} detail={`${pendingApprovals.filter((row) => row.approval.riskLevel === 'medium').length} requests`} tone="warning" />
                        <AIProgressRow label="Low risk" value={riskCounts.low} detail={`${pendingApprovals.filter((row) => row.approval.riskLevel === 'low').length} requests`} tone="success" />
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Signals"
                    title="Queue pressure"
                    description="Short operational guidance based on the current approval state."
                >
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {pendingApprovals.length === 0
                                ? 'The approval queue is clear.'
                                : `${pendingApprovals.length} approvals are waiting, with ${pendingApprovals.filter((row) => row.approval.riskLevel === 'high' || row.approval.riskLevel === 'critical').length} at high risk.`}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {aiTasks.filter((task) => task.status === 'waiting_approval').length} tasks are blocked behind reviewer action.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            The oldest unresolved approval is {oldestPending ? formatBigIntDateTime(oldestPending) : 'not applicable'}.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="History"
                    title="Recent decisions"
                    description="Latest resolved approvals with reviewer and timing context."
                >
                    <Stack spacing={1.1}>
                        {approvalsWithContext.filter((row) => row.approval.status !== 'pending').slice(0, 6).map(({ approval, reviewer, task }) => (
                            <Stack key={approval.id.toString()} spacing={0.35}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {approval.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {approval.status} by {reviewer?.name || reviewer?.email || 'Unknown'} • {task?.title || 'No task'} • {formatBigIntDateTime(approval.decidedAt)}
                                </Typography>
                            </Stack>
                        ))}
                        {approvalsWithContext.filter((row) => row.approval.status !== 'pending').length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No approval decisions have been recorded yet.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiApprovalsPage = AIApprovalsPage;
