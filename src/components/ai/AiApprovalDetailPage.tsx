import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, NONE_U64, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIApprovalDetailPage({ approvalId }: { approvalId: string }) {
    const parsedId = safeParseBigInt(approvalId);
    const {
        aiApprovals,
        aiTasks,
        aiAgents,
        usersById,
        aiActivities,
    } = useAIWorkspaceData();

    const decideAiApproval = useReducer(reducers.decideAiApproval);

    const approval = parsedId == null ? null : aiApprovals.find((row) => row.id === parsedId) ?? null;
    const task = approval ? aiTasks.find((row) => row.id === approval.taskId) ?? null : null;
    const agent = approval ? aiAgents.find((row) => row.id === approval.agentId) ?? null : null;
    const requester = approval ? usersById.get(approval.requesterUserId) ?? null : null;
    const reviewer = approval && approval.reviewerUserId !== NONE_U64
        ? usersById.get(approval.reviewerUserId) ?? null
        : null;
    const relatedEvents = approval
        ? [...aiActivities]
            .filter((event) => event.approvalId === approval.id)
            .sort((left, right) => Number(right.createdAt - left.createdAt))
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
                <AIPageIntro
                    eyebrow="Approvals"
                    title="Approval not found"
                    description="The requested approval does not exist in this workspace or the id is invalid."
                    actionSlot={
                        <Button component={Link} to="/ai/approvals" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back to approvals
                        </Button>
                    }
                />
            </AIWorkspacePage>
        );
    }

    return (
        <AIWorkspacePage page="approvals">
            <AIPageIntro
                eyebrow="Approval detail"
                title={approval.title}
                description={approval.summary || 'No summary provided.'}
                supportingCopy={`${task?.title || 'No linked task'}${agent ? ` • ${agent.name}` : ''}`}
                actionSlot={
                    <Stack direction="row" spacing={1}>
                        <Button component={Link} to="/ai/approvals" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back
                        </Button>
                        {approval.status === 'pending' ? (
                            <>
                                <Button variant="contained" sx={{ textTransform: 'none' }} onClick={() => handleDecision('approved')}>
                                    Approve
                                </Button>
                                <Button variant="outlined" color="error" sx={{ textTransform: 'none' }} onClick={() => handleDecision('rejected')}>
                                    Reject
                                </Button>
                            </>
                        ) : null}
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Status" value={approval.status} caption="Current approval state" tone={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'warning'} />
                <AIStatCard label="Risk" value={approval.riskLevel} caption="Declared review level" tone={approval.riskLevel === 'high' || approval.riskLevel === 'critical' ? 'danger' : approval.riskLevel === 'medium' ? 'warning' : 'info'} />
                <AIStatCard label="Requester" value={requester?.name || requester?.email || 'Unknown'} caption="Who requested this action" tone="neutral" />
                <AIStatCard label="Reviewer" value={reviewer?.name || reviewer?.email || (approval.status === 'pending' ? 'Waiting' : 'Unknown')} caption="Who closed the approval" tone="info" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Context" title="Linked work" description="Task and agent context for this approval.">
                    <Stack spacing={1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Task: {task?.title || 'Not linked'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            Agent: {agent?.name || 'Not linked'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Requested {formatBigIntDateTime(approval.createdAt)}
                            {approval.decidedAt !== NONE_U64 ? ` • Decided ${formatBigIntDateTime(approval.decidedAt)}` : ''}
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Decision" title="Current state" description="What still needs to happen.">
                    <Stack spacing={1}>
                        <AIStatusPill label={approval.status} tone={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'warning'} />
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            {approval.status === 'pending'
                                ? 'This request is still waiting for a reviewer decision.'
                                : `This request was ${approval.status}${reviewer ? ` by ${reviewer.name || reviewer.email}` : ''}.`}
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Audit" title="Related activity" description="Activity records written for this approval.">
                    <Stack spacing={1}>
                        {relatedEvents.slice(0, 8).map((event) => (
                            <Stack key={event.id.toString()} spacing={0.35}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {event.description}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {event.eventType} • {formatBigIntDateTime(event.createdAt)}
                                </Typography>
                            </Stack>
                        ))}
                        {relatedEvents.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No additional activity has been recorded for this approval yet.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiApprovalDetailPage = AIApprovalDetailPage;
