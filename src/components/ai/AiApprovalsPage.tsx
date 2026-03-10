import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type ApprovalTab = 'pending' | 'resolved' | 'all';

const TABS: { value: ApprovalTab; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
];

export function AIApprovalsPage() {
    const {
        aiApprovals,
        aiTasks,
        aiAgents,
        usersById,
    } = useAIWorkspaceData();

    const decideAiApproval = useReducer(reducers.decideAiApproval);
    const [tab, setTab] = useState<ApprovalTab>('pending');
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

    const filtered = useMemo(() => {
        if (tab === 'pending') return approvalsWithContext.filter((r) => r.approval.status === 'pending');
        if (tab === 'resolved') return approvalsWithContext.filter((r) => r.approval.status !== 'pending');
        return approvalsWithContext;
    }, [approvalsWithContext, tab]);

    const tabCount = (t: ApprovalTab) => {
        if (t === 'pending') return approvalsWithContext.filter((r) => r.approval.status === 'pending').length;
        if (t === 'resolved') return approvalsWithContext.filter((r) => r.approval.status !== 'pending').length;
        return approvalsWithContext.length;
    };

    const handleDecision = async (approvalId: bigint, status: 'approved' | 'rejected') => {
        try {
            await decideAiApproval({ approvalId, status });
            toast.success(status === 'approved' ? 'Approval granted' : 'Approval rejected');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update approval');
        }
    };

    const riskColor = (level: string) =>
        level === 'high' || level === 'critical' ? '#e33d4f' :
        level === 'medium' ? '#ff9800' : '#555';

    return (
        <AIWorkspacePage page="approvals">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Approvals
                </Typography>
                {approvalsWithContext.filter((r) => r.approval.status === 'pending').length > 0 && (
                    <Typography variant="caption" sx={{ color: '#ff9800' }}>
                        {approvalsWithContext.filter((r) => r.approval.status === 'pending').length} pending
                    </Typography>
                )}
            </Stack>

            {/* Tabs */}
            <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid #1a1a1a', mt: -0.5 }}>
                {TABS.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        style={{
                            padding: '6px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: tab === t.value ? '#ffffff' : '#555',
                            borderBottom: tab === t.value ? '2px solid #ffffff' : '2px solid transparent',
                            fontSize: '0.8rem',
                            fontWeight: tab === t.value ? 600 : 400,
                            transition: 'color 0.15s',
                        }}
                    >
                        {t.label}
                        {tabCount(t.value) > 0 && (
                            <span style={{ marginLeft: 5, fontSize: '0.7rem', color: tab === t.value ? '#858585' : '#444' }}>
                                {tabCount(t.value)}
                            </span>
                        )}
                    </button>
                ))}
            </Stack>

            {/* Count */}
            {filtered.length > 0 && (
                <Typography variant="caption" sx={{ color: '#555' }}>
                    {filtered.length} approval{filtered.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* Approval list */}
            {aiApprovals.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        No approval records yet.
                    </Typography>
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>
                            No approvals match this filter.
                        </Typography>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.map(({ approval, task, agent, requester, reviewer }) => (
                        <Stack
                            key={approval.id.toString()}
                            direction="row"
                            alignItems="center"
                            spacing={2}
                            sx={{
                                px: 2,
                                py: 1.5,
                                borderBottom: '1px solid #1a1a1a',
                                '&:last-child': { borderBottom: 'none' },
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                            }}
                        >
                            {/* Risk dot */}
                            <Box
                                sx={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    bgcolor: riskColor(approval.riskLevel),
                                    flexShrink: 0,
                                }}
                            />

                            {/* Main content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {approval.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#555' }}>
                                    {task?.title || 'No task linked'}
                                    {agent ? ` • ${agent.name}` : ''}
                                    {' • '}
                                    {approval.status === 'pending'
                                        ? `requested ${formatRelativeTime(approval.createdAt, now)} by ${requester?.name || requester?.email || 'Unknown'}`
                                        : `${approval.status} by ${reviewer?.name || reviewer?.email || 'Unknown'}`}
                                </Typography>
                            </Box>

                            {/* Right: risk + status + actions */}
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                                <Chip
                                    size="small"
                                    label={approval.riskLevel}
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: 20,
                                        bgcolor: 'transparent',
                                        color: riskColor(approval.riskLevel),
                                        border: '1px solid #1a1a1a',
                                        borderRadius: '4px',
                                    }}
                                />
                                <Chip
                                    size="small"
                                    label={approval.status}
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: 20,
                                        bgcolor: 'transparent',
                                        color: approval.status === 'approved' ? '#38c872' : approval.status === 'rejected' ? '#e33d4f' : '#ff9800',
                                        border: '1px solid #1a1a1a',
                                        borderRadius: '4px',
                                    }}
                                />
                                {approval.status === 'pending' && (
                                    <>
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#38c872', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                            onClick={() => handleDecision(approval.id, 'approved')}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#e33d4f', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                            onClick={() => handleDecision(approval.id, 'rejected')}
                                        >
                                            Reject
                                        </Button>
                                    </>
                                )}
                                <Button
                                    component="a"
                                    href={`/ai/approvals/${approval.id.toString()}`}
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                >
                                    Details →
                                </Button>
                            </Stack>
                        </Stack>
                    ))}
                </Box>
            )}
        </AIWorkspacePage>
    );
}

export const AiApprovalsPage = AIApprovalsPage;
