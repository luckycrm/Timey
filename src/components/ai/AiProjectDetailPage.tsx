import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const PROJECT_STATUSES = ['planning', 'active', 'watching', 'completed', 'paused'] as const;

export function AIProjectDetailPage({ projectId }: { projectId: string }) {
    const parsedId = safeParseBigInt(projectId);
    const { aiProjects, aiAgents, aiGoals, aiTasks, aiApprovals, usersById } = useAIWorkspaceData();
    const updateAiProjectStatus = useReducer(reducers.updateAiProjectStatus);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [editStatus, setEditStatus] = useState('');
    const [saving, setSaving] = useState(false);

    const project = parsedId == null ? null : aiProjects.find((r) => r.id === parsedId) ?? null;
    const owner = project ? usersById.get(project.ownerUserId) ?? null : null;
    const agents = project ? aiAgents.filter((r) => r.projectId === project.id) : [];
    const goals = project ? aiGoals.filter((r) => r.projectId === project.id) : [];
    const tasks = project ? aiTasks.filter((r) => r.projectId === project.id) : [];
    const pendingApprovals = project ? aiApprovals.filter((a) => a.status === 'pending' && tasks.some((t) => t.id === a.taskId)).length : 0;

    if (!project) {
        return (
            <AIWorkspacePage page="projects">
                <Button component={Link} to="/ai/projects" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0 }}>
                    ← Projects
                </Button>
                <Typography variant="body2" sx={{ color: '#555' }}>Project not found.</Typography>
            </AIWorkspacePage>
        );
    }

    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const blockedTasks = tasks.filter((t) => ['blocked', 'failed'].includes(t.status));
    const runningTasks = tasks.filter((t) => t.status === 'running');
    const waitingApproval = tasks.filter((t) => t.status === 'waiting_approval');
    const taskPct = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
    const avgGoalProgress = goals.length === 0 ? 0 : Math.round(goals.reduce((s, g) => s + Number(g.progressPct), 0) / goals.length);
    const recentTasks = [...tasks].sort((a, b) => Number(b.updatedAt - a.updatedAt)).slice(0, 8);

    const statusTone = project.status === 'active' ? 'success' : project.status === 'watching' ? 'warning' : 'neutral';

    const handleOpenStatusDialog = () => {
        setEditStatus(project.status);
        setStatusDialogOpen(true);
    };

    const handleSaveStatus = async () => {
        setSaving(true);
        try {
            await updateAiProjectStatus({ projectId: project.id, status: editStatus });
            toast.success('Project status updated');
            setStatusDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AIWorkspacePage page="projects">
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.5}>
                    <Button component={Link} to="/ai/projects" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0, alignSelf: 'flex-start' }}>
                        ← Projects
                    </Button>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{project.name}</Typography>
                        <AIStatusPill label={project.status} tone={statusTone} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        {agents.length} agent{agents.length !== 1 ? 's' : ''} • {goals.length} goal{goals.length !== 1 ? 's' : ''} • {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        {owner ? ` • ${owner.name || owner.email}` : ''}
                        {` • updated ${formatRelativeTime(project.updatedAt)}`}
                    </Typography>
                </Stack>
                <Button variant="outlined" size="small" onClick={handleOpenStatusDialog} sx={{ textTransform: 'none', flexShrink: 0 }}>
                    Change status
                </Button>
            </Stack>

            {/* Status edit dialog */}
            <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px' } }}>
                <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Change project status</DialogTitle>
                <DialogContent>
                    <TextField
                        select
                        size="small"
                        label="Status"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        fullWidth
                        sx={{ mt: 1 }}
                    >
                        {PROJECT_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1a1a1a' }}>
                    <Button variant="text" onClick={() => setStatusDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none', color: '#555' }}>Cancel</Button>
                    <Button variant="contained" disabled={saving || editStatus === project.status} onClick={handleSaveStatus} sx={{ textTransform: 'none' }}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {project.summary && (
                <Typography variant="body2" sx={{ color: '#858585' }}>{project.summary}</Typography>
            )}

            {/* Progress bars */}
            <Stack spacing={1}>
                <Stack spacing={0.4}>
                    <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: '#555' }}>Task completion</Typography>
                        <Typography variant="caption" sx={{ color: '#858585' }}>{taskPct}% ({completedTasks}/{tasks.length})</Typography>
                    </Stack>
                    <Box sx={{ height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${taskPct}%`, height: '100%', borderRadius: '999px', bgcolor: blockedTasks.length > 0 ? '#ff9800' : '#38c872' }} />
                    </Box>
                </Stack>
                {goals.length > 0 && (
                    <Stack spacing={0.4}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" sx={{ color: '#555' }}>Avg goal progress</Typography>
                            <Typography variant="caption" sx={{ color: '#858585' }}>{avgGoalProgress}%</Typography>
                        </Stack>
                        <Box sx={{ height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <Box sx={{ width: `${avgGoalProgress}%`, height: '100%', borderRadius: '999px', bgcolor: '#7eb0ff' }} />
                        </Box>
                    </Stack>
                )}
            </Stack>

            {/* Status pills */}
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
                {blockedTasks.length > 0 && <AIStatusPill label={`${blockedTasks.length} blocked`} tone="danger" />}
                {waitingApproval.length > 0 && <AIStatusPill label={`${waitingApproval.length} waiting approval`} tone="warning" />}
                {pendingApprovals > 0 && <AIStatusPill label={`${pendingApprovals} pending approvals`} tone="warning" />}
                {runningTasks.length > 0 && <AIStatusPill label={`${runningTasks.length} running`} tone="info" />}
            </Stack>

            <Typography variant="caption" sx={{ color: '#444' }}>
                Created {formatBigIntDateTime(project.createdAt)}
            </Typography>

            {/* Agents */}
            {agents.length > 0 && (
                <AISectionCard title="Assigned agents" description={`${agents.length} agent${agents.length !== 1 ? 's' : ''}`}>
                    <Stack spacing={0}>
                        {agents.map((agent, i) => (
                            <Stack
                                key={agent.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ py: 1, borderBottom: i < agents.length - 1 ? '1px solid #111' : 'none' }}
                            >
                                <Stack spacing={0.1}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{agent.name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{agent.role} • {agent.department}</Typography>
                                </Stack>
                                <AIStatusPill label={agent.status} tone={agent.status === 'active' ? 'success' : agent.status === 'attention' ? 'warning' : 'neutral'} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            )}

            {/* Goals */}
            {goals.length > 0 && (
                <AISectionCard title="Goals" description={`${goals.length} goal${goals.length !== 1 ? 's' : ''}`}>
                    <Stack spacing={0}>
                        {goals.slice(0, 8).map((goal, i) => (
                            <Stack
                                key={goal.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ py: 1, borderBottom: i < goals.length - 1 ? '1px solid #111' : 'none' }}
                            >
                                <Stack spacing={0.1}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{goal.title}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{goal.progressPct.toString()}% • due {formatBigIntDateTime(goal.dueAt)}</Typography>
                                </Stack>
                                <AIStatusPill label={goal.status} tone={goal.status === 'on_track' ? 'success' : goal.status === 'blocked' ? 'danger' : 'warning'} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            )}

            {/* Recent tasks */}
            {recentTasks.length > 0 && (
                <AISectionCard title="Tasks" description={`${tasks.length} task${tasks.length !== 1 ? 's' : ''} • ${runningTasks.length} running`}>
                    <Stack spacing={0}>
                        {recentTasks.map((task, i) => (
                            <Stack
                                key={task.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ py: 1, borderBottom: i < recentTasks.length - 1 ? '1px solid #111' : 'none' }}
                            >
                                <Stack spacing={0.1}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{task.title}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{task.priority} • {formatRelativeTime(task.updatedAt)}</Typography>
                                </Stack>
                                <AIStatusPill label={task.status} tone={task.status === 'completed' ? 'success' : task.status === 'blocked' || task.status === 'failed' ? 'danger' : 'neutral'} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            )}
        </AIWorkspacePage>
    );
}

export const AiProjectDetailPage = AIProjectDetailPage;
