import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, NONE_U64, safeParseBigInt } from './aiUtils';
import { humanizeRuntimeToken } from './AIRuntimeDetailBlocks';
import { useAIWorkspaceData } from './useAIWorkspaceData';

function parseMetadata(json: string): Record<string, unknown> | null {
    try { return JSON.parse(json); } catch { return null; }
}

export function AIApprovalDetailPage({ approvalId }: { approvalId: string }) {
    const parsedId = safeParseBigInt(approvalId);
    const { aiApprovals, aiTasks, aiAgents, usersById, aiActivities } = useAIWorkspaceData();

    const decideAiApproval = useReducer(reducers.decideAiApproval);
    const [showRawPayload, setShowRawPayload] = useState(false);
    const [justApproved, setJustApproved] = useState(false);
    const [justRejected, setJustRejected] = useState(false);

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
    const metadata = approval ? parseMetadata(approval.metadataJson) : null;

    const handleDecision = async (status: 'approved' | 'rejected') => {
        if (!approval) return;
        try {
            await decideAiApproval({ approvalId: approval.id, status });
            if (status === 'approved') { setJustApproved(true); setJustRejected(false); }
            else { setJustRejected(true); setJustApproved(false); }
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
    const showApprovedBanner = justApproved || (!justRejected && approval.status === 'approved');
    const showRejectedBanner = justRejected || (!justApproved && approval.status === 'rejected');

    return (
        <AIWorkspacePage page="approvals">
            {/* Approved banner */}
            {showApprovedBanner && (
                <Box sx={{
                    border: '1px solid rgba(74,222,128,0.4)',
                    bgcolor: 'rgba(74,222,128,0.08)',
                    borderRadius: 1,
                    px: 2,
                    py: 1.5,
                }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                        <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <CheckCircleOutlineIcon sx={{ color: '#4ade80', fontSize: 18, mt: 0.2 }} />
                            <Stack spacing={0.15}>
                                <Typography variant="body2" sx={{ color: '#4ade80', fontWeight: 600 }}>Approval confirmed</Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(74,222,128,0.8)' }}>
                                    Requesting agent was notified to proceed with the approved action.
                                </Typography>
                            </Stack>
                        </Stack>
                        {task && (
                            <Button
                                component={Link}
                                to={`/ai/tasks/${task.id.toString()}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    borderColor: 'rgba(74,222,128,0.4)',
                                    color: '#4ade80',
                                    flexShrink: 0,
                                    '&:hover': { borderColor: '#4ade80', bgcolor: 'rgba(74,222,128,0.12)' },
                                }}
                            >
                                Review linked task
                            </Button>
                        )}
                    </Stack>
                </Box>
            )}

            {/* Rejected banner */}
            {showRejectedBanner && (
                <Box sx={{
                    border: '1px solid rgba(239,68,68,0.4)',
                    bgcolor: 'rgba(239,68,68,0.08)',
                    borderRadius: 1,
                    px: 2,
                    py: 1.5,
                }}>
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <CancelOutlinedIcon sx={{ color: '#ef4444', fontSize: 18, mt: 0.2 }} />
                        <Stack spacing={0.15}>
                            <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>Approval rejected</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(239,68,68,0.8)' }}>
                                The requesting agent was notified that this action was not approved.
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>
            )}

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
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Typography variant="caption" sx={{ color: '#555' }}>
                            {approval.actionType ? humanizeRuntimeToken(approval.actionType) : ''}
                            {requester ? ` • requested by ${requester.name || requester.email}` : ''}
                            {` • ${formatBigIntDateTime(approval.createdAt)}`}
                        </Typography>
                    </Stack>
                    {/* Links to task and agent */}
                    <Stack direction="row" spacing={1.5} flexWrap="wrap">
                        {task && (
                            <Typography
                                component={Link}
                                to={`/ai/tasks/${task.id.toString()}`}
                                variant="caption"
                                sx={{ color: '#7eb0ff', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                                Task: {task.title}
                            </Typography>
                        )}
                        {agent && (
                            <Typography
                                component={Link}
                                to={`/ai/agents/${agent.id.toString()}`}
                                variant="caption"
                                sx={{ color: '#7eb0ff', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                                Agent: {agent.name}
                            </Typography>
                        )}
                    </Stack>
                </Stack>
                {approval.status === 'pending' && (
                    <Stack direction="row" spacing={1} flexShrink={0}>
                        <Button variant="contained" size="small" sx={{ textTransform: 'none', bgcolor: '#166534', '&:hover': { bgcolor: '#15803d' } }} onClick={() => handleDecision('approved')}>
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
            {approval.status !== 'pending' && (
                <Typography variant="body2" sx={{ color: '#858585' }}>
                    {`${approval.status === 'approved' ? 'Approved' : 'Rejected'}${reviewer ? ` by ${reviewer.name || reviewer.email}` : ''}${approval.decidedAt !== NONE_U64 ? ` on ${formatBigIntDateTime(approval.decidedAt)}` : ''}.`}
                </Typography>
            )}

            {/* Metadata / payload */}
            {metadata && Object.keys(metadata).length > 0 && (
                <AISectionCard title="Request details">
                    <Stack spacing={1}>
                        {/* Key-value pairs from metadata */}
                        {Object.entries(metadata).slice(0, 8).map(([key, value]) => (
                            <Stack key={key} direction="row" spacing={2} alignItems="flex-start">
                                <Typography variant="caption" sx={{ color: '#555', minWidth: 120, flexShrink: 0 }}>
                                    {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585', wordBreak: 'break-all', fontFamily: typeof value === 'string' && value.length > 60 ? 'monospace' : 'inherit' }}>
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </Typography>
                            </Stack>
                        ))}
                        {/* Raw payload toggle */}
                        <button
                            type="button"
                            onClick={() => setShowRawPayload((v) => !v)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#555',
                                fontSize: '0.75rem',
                                padding: 0,
                                marginTop: 4,
                            }}
                        >
                            <ChevronRightIcon sx={{ fontSize: 14, transform: showRawPayload ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                            See full request
                        </button>
                        <Collapse in={showRawPayload}>
                            <Box
                                component="pre"
                                sx={{
                                    fontSize: '0.72rem',
                                    color: '#858585',
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid #1a1a1a',
                                    borderRadius: 1,
                                    p: 1.5,
                                    overflowX: 'auto',
                                    fontFamily: 'monospace',
                                    m: 0,
                                }}
                            >
                                {JSON.stringify(metadata, null, 2)}
                            </Box>
                        </Collapse>
                    </Stack>
                </AISectionCard>
            )}

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
