import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, NONE_U64, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIApprovalDetailPage({ approvalId }: { approvalId: string }) {
    const parsedId = safeParseBigInt(approvalId);
    const { aiApprovals, aiTasks, aiAgents, usersById, aiActivities } = useAIWorkspaceData();

    const decideAiApproval = useReducer(reducers.decideAiApproval);

    const approval = parsedId == null ? null : aiApprovals.find((r) => r.id === parsedId) ?? null;
    const task = approval ? aiTasks.find((r) => r.id === approval.taskId) ?? null : null;
    const agent = approval ? aiAgents.find((r) => r.id === approval.agentId) ?? null : null;
    const requester = approval ? usersById.get(approval.requesterUserId) ?? null : null;
    const reviewer = approval && approval.reviewerUserId !== NONE_U64
        ? usersById.get(approval.reviewerUserId) ?? null
        : null;
    const relatedEvents = approval
        ? [...aiActivities].filter((e) => e.approvalId === approval.id).sort((a, b) => Number(b.createdAt - a.createdAt))
        : [];

    const handleDecision = async (status: 'approved' | 'rejected') => {
        if (!approval) return;
        try {
            await decideAiApproval({ approvalId: approval.id, status });
            toast.success(status === 'approved' ? 'Approval granted' : 'Approval rejected');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update approval');
        }
    };

    if (!approval) {
        return (
            <AIWorkspacePage page="approvals">
                <Button component={Link} to="/ai/approvals" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0 }}>
                    ← Approvals
                </Button>
                <Typography variant="body2" sx={{ color: '#555' }}>Approval not found.</Typography>
            </AIWorkspacePage>
        );
    }

    const statusTone = approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'warning';
    const riskTone = approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 'danger' : approval.riskLevel === 'medium' ? 'warning' : 'info';

    return (
        <AIWorkspacePage page="approvals">
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.5}>
                    <Button component={Link} to="/ai/approvals" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0, alignSelf: 'flex-start' }}>
                        ← Approvals
                    </Button>
                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{approval.title}</Typography>
                        <AIStatusPill label={approval.status} tone={statusTone} />
                        <AIStatusPill label={approval.riskLevel} tone={riskTone} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        {task ? task.title : 'No linked task'}
                        {agent ? ` • ${agent.name}` : ''}
                        {requester ? ` • requested by ${requester.name || requester.email}` : ''}
                        {` • ${formatBigIntDateTime(approval.createdAt)}`}
                    </Typography>
                </Stack>
                {approval.status === 'pending' && (
                    <Stack direction="row" spacing={1} flexShrink={0}>
                        <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={() => handleDecision('approved')}>
                            Approve
                        </Button>
                        <Button variant="outlined" color="error" size="small" sx={{ textTransform: 'none' }} onClick={() => handleDecision('rejected')}>
                            Reject
                        </Button>
                    </Stack>
                )}
            </Stack>

            {/* Summary */}
            {approval.summary && (
                <Typography variant="body2" sx={{ color: '#858585' }}>{approval.summary}</Typography>
            )}

            {/* Decision state */}
            <Typography variant="body2" sx={{ color: '#858585' }}>
                {approval.status === 'pending'
                    ? 'Waiting for a reviewer decision.'
                    : `${approval.status === 'approved' ? 'Approved' : 'Rejected'}${reviewer ? ` by ${reviewer.name || reviewer.email}` : ''}${approval.decidedAt !== NONE_U64 ? ` on ${formatBigIntDateTime(approval.decidedAt)}` : ''}.`}
            </Typography>

            {/* Related activity */}
            {relatedEvents.length > 0 && (
                <AISectionCard title="Related activity" description={`${relatedEvents.length} event${relatedEvents.length !== 1 ? 's' : ''}`}>
                    <Stack spacing={0}>
                        {relatedEvents.slice(0, 10).map((event, i) => (
                            <Stack
                                key={event.id.toString()}
                                spacing={0.2}
                                sx={{ py: 1, borderBottom: i < relatedEvents.length - 1 ? '1px solid #111' : 'none' }}
                            >
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{event.description}</Typography>
                                <Typography variant="caption" sx={{ color: '#555' }}>{event.eventType} • {formatBigIntDateTime(event.createdAt)}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            )}
        </AIWorkspacePage>
    );
}

export const AiApprovalDetailPage = AIApprovalDetailPage;
