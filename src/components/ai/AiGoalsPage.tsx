import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const goalStatuses = ['on_track', 'watching', 'blocked', 'completed'] as const;
type GoalStatus = (typeof goalStatuses)[number];

const statusLabel: Record<GoalStatus, string> = {
    on_track: 'On track',
    watching: 'Watching',
    blocked: 'Blocked',
    completed: 'Completed',
};

const statusColor: Record<GoalStatus, string> = {
    on_track: '#38c872',
    watching: '#ff9800',
    blocked: '#e33d4f',
    completed: '#7eb0ff',
};

type GoalTab = 'all' | 'on_track' | 'watching' | 'blocked' | 'completed';

const TABS: { value: GoalTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'on_track', label: 'On track' },
    { value: 'watching', label: 'Watching' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'completed', label: 'Completed' },
];

export function AIGoalsPage() {
    const {
        currentOrgId,
        aiGoals,
        aiProjects,
        aiTasks,
        usersById,
    } = useAIWorkspaceData();

    const createAiGoal = useReducer(reducers.createAiGoal);
    const updateAiGoalProgress = useReducer(reducers.updateAiGoalProgress);

    const [form, setForm] = useState({
        title: '',
        description: '',
        projectId: '0',
        status: 'watching',
        progressPct: '25',
        dueAt: '',
    });
    const [createOpen, setCreateOpen] = useState(false);
    const [tab, setTab] = useState<GoalTab>('all');

    const goalRows = useMemo(
        () => [...aiGoals]
            .sort((left, right) => Number(right.updatedAt - left.updatedAt))
            .map((goal) => {
                const linkedTasks = aiTasks.filter((task) => task.goalId === goal.id);
                return {
                    goal,
                    owner: usersById.get(goal.ownerUserId) ?? null,
                    project: aiProjects.find((project) => project.id === goal.projectId) ?? null,
                    linkedTasks,
                    runningTasks: linkedTasks.filter((task) => task.status === 'running').length,
                    blockedTasks: linkedTasks.filter((task) => ['blocked', 'failed'].includes(task.status)).length,
                    waitingTasks: linkedTasks.filter((task) => task.status === 'waiting_approval').length,
                };
            }),
        [aiGoals, aiProjects, aiTasks, usersById]
    );

    const filtered = useMemo(() => {
        if (tab === 'all') return goalRows;
        return goalRows.filter((r) => r.goal.status === tab);
    }, [goalRows, tab]);

    const tabCount = (t: GoalTab) => {
        if (t === 'all') return aiGoals.length;
        return aiGoals.filter((g) => g.status === t).length;
    };

    const handleCreateGoal = async (event: React.FormEvent) => {
        event.preventDefault();
        if (currentOrgId == null) return;
        try {
            await createAiGoal({
                orgId: currentOrgId,
                projectId: BigInt(form.projectId),
                title: form.title.trim(),
                description: form.description.trim(),
                status: form.status,
                progressPct: BigInt(Math.max(0, Math.min(100, Number(form.progressPct || '0')))),
                dueAt: form.dueAt ? BigInt(new Date(form.dueAt).getTime()) : 0n,
            });
            setForm({ title: '', description: '', projectId: form.projectId, status: 'watching', progressPct: '25', dueAt: '' });
            toast.success('Goal created');
            setCreateOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create goal');
        }
    };

    return (
        <AIWorkspacePage page="goals">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Goals
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setCreateOpen(true)}
                    sx={{
                        textTransform: 'none',
                        fontSize: '0.8rem',
                        borderColor: '#1a1a1a',
                        color: '#858585',
                        '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' },
                    }}
                >
                    New Goal
                </Button>
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
                    {filtered.length} goal{filtered.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* Goal list */}
            {aiGoals.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>No goals yet.</Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{ mt: 2, textTransform: 'none', borderColor: '#1a1a1a', color: '#858585', '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' } }}
                        onClick={() => setCreateOpen(true)}
                    >
                        Create your first goal
                    </Button>
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>No goals match this filter.</Typography>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.map(({ goal, owner, project, linkedTasks, blockedTasks }) => {
                        const progressPct = Number(goal.progressPct);
                        const color = statusColor[goal.status as GoalStatus] ?? '#555';
                        return (
                            <Stack
                                key={goal.id.toString()}
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
                                {/* Status dot */}
                                <Box
                                    sx={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        bgcolor: color,
                                        flexShrink: 0,
                                    }}
                                />

                                {/* Name + meta + progress */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {goal.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>
                                        {project?.name || 'No project'}
                                        {owner ? ` • ${owner.name || owner.email}` : ''}
                                        {' • '}
                                        {linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''}
                                        {blockedTasks > 0 ? ` • ${blockedTasks} blocked` : ''}
                                    </Typography>
                                    <Box sx={{ mt: 0.75, maxWidth: 240 }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={progressPct}
                                            sx={{
                                                height: 3,
                                                borderRadius: 999,
                                                bgcolor: 'rgba(255,255,255,0.06)',
                                                '& .MuiLinearProgress-bar': {
                                                    borderRadius: 999,
                                                    bgcolor: blockedTasks > 0 ? '#ff9800' : '#38c872',
                                                },
                                            }}
                                        />
                                    </Box>
                                </Box>

                                {/* Right */}
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                                    <Typography variant="caption" sx={{ color: '#555', minWidth: 32, textAlign: 'right' }}>
                                        {progressPct}%
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={statusLabel[goal.status as GoalStatus] ?? goal.status}
                                        sx={{
                                            fontSize: '0.7rem',
                                            height: 20,
                                            bgcolor: 'transparent',
                                            color,
                                            border: '1px solid #1a1a1a',
                                            borderRadius: '4px',
                                        }}
                                    />
                                    {goal.status !== 'completed' && (
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                            onClick={() =>
                                                updateAiGoalProgress({
                                                    goalId: goal.id,
                                                    progressPct: BigInt(Math.min(100, progressPct + 10)),
                                                    status: progressPct + 10 >= 100 ? 'completed' : goal.status,
                                                }).catch((error) => {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to update goal');
                                                })
                                            }
                                        >
                                            +10%
                                        </Button>
                                    )}
                                    <Button
                                        component="a"
                                        href={`/ai/goals/${goal.id.toString()}`}
                                        size="small"
                                        variant="text"
                                        sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1, '&:hover': { color: '#fff' } }}
                                    >
                                        Details →
                                    </Button>
                                </Stack>
                            </Stack>
                        );
                    })}
                </Box>
            )}

            {/* Create Goal Dialog */}
            <Dialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                        New Goal
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack component="form" spacing={1.4} id="create-goal-form" onSubmit={handleCreateGoal}>
                        <TextField
                            size="small"
                            label="Goal title"
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Reduce proposal turnaround time"
                            autoFocus
                        />
                        <TextField
                            size="small"
                            label="Description"
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            multiline
                            minRows={3}
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Project"
                                value={form.projectId}
                                onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                <MenuItem value="0">No project</MenuItem>
                                {aiProjects.map((project) => (
                                    <MenuItem key={project.id.toString()} value={project.id.toString()}>
                                        {project.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Status"
                                value={form.status}
                                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                                sx={{ flex: 1 }}
                            >
                                {goalStatuses.map((status) => (
                                    <MenuItem key={status} value={status}>
                                        {statusLabel[status]}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Progress %"
                                type="number"
                                value={form.progressPct}
                                onChange={(event) => setForm((current) => ({ ...current, progressPct: event.target.value }))}
                                sx={{ flex: 1 }}
                            />
                        </Stack>
                        <TextField
                            size="small"
                            label="Due date"
                            type="datetime-local"
                            value={form.dueAt}
                            onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1a1a1a' }}>
                    <Button
                        variant="text"
                        onClick={() => setCreateOpen(false)}
                        sx={{ textTransform: 'none', color: '#555' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-goal-form"
                        variant="contained"
                        disabled={currentOrgId == null || !form.title.trim()}
                        sx={{ textTransform: 'none' }}
                    >
                        Create goal
                    </Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}

export const AiGoalsPage = AIGoalsPage;
