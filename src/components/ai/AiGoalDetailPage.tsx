import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AISectionCard, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';
import { AiGoalTree } from './AiGoalTree';

export function AIGoalDetailPage({ goalId }: { goalId: string }) {
    const parsedId = safeParseBigInt(goalId);
    const { aiGoals, aiProjects, aiTasks, usersById } = useAIWorkspaceData();

    const updateAiGoalProgress = useReducer(reducers.updateAiGoalProgress);

    const goal = parsedId == null ? null : aiGoals.find((r) => r.id === parsedId) ?? null;
    const project = goal ? aiProjects.find((r) => r.id === goal.projectId) ?? null : null;
    const owner = goal ? usersById.get(goal.ownerUserId) ?? null : null;
    const tasks = goal ? aiTasks.filter((r) => r.goalId === goal.id) : [];

    if (!goal) {
        return (
            <AIWorkspacePage page="goals">
                <Button component={Link} to="/ai/goals" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0 }}>
                    ← Goals
                </Button>
                <Typography variant="body2" sx={{ color: '#555' }}>Goal not found.</Typography>
            </AIWorkspacePage>
        );
    }

    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const blockedTasks = tasks.filter((t) => ['blocked', 'failed'].includes(t.status)).length;
    const runningTasks = tasks.filter((t) => t.status === 'running').length;
    const waitingTasks = tasks.filter((t) => t.status === 'waiting_approval').length;
    const handleAdvance = async () => {
        try {
            await updateAiGoalProgress({
                goalId: goal.id,
                progressPct: BigInt(Math.min(100, Number(goal.progressPct) + 10)),
                status: Number(goal.progressPct) + 10 >= 100 ? 'completed' : goal.status,
            });
            toast.success('Goal updated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update goal');
        }
    };

    const tone = goal.status === 'on_track' ? 'success' : goal.status === 'blocked' ? 'danger' : goal.status === 'completed' ? 'info' : 'warning';

    return (
        <AIWorkspacePage page="goals">
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.5}>
                    <Button component={Link} to="/ai/goals" variant="text" size="small" sx={{ textTransform: 'none', color: '#555', minWidth: 0, px: 0, alignSelf: 'flex-start' }}>
                        ← Goals
                    </Button>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{goal.title}</Typography>
                        <AIStatusPill label={goal.status} tone={tone} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        {goal.progressPct.toString()}% progress
                        {project ? ` • ${project.name}` : ''}
                        {owner ? ` • ${owner.name || owner.email}` : ''}
                        {` • updated ${formatRelativeTime(goal.updatedAt)}`}
                    </Typography>
                </Stack>
                {goal.status !== 'completed' && (
                    <Button variant="contained" size="small" sx={{ textTransform: 'none', flexShrink: 0 }} onClick={handleAdvance}>
                        Advance +10%
                    </Button>
                )}
            </Stack>

            {/* Progress bar */}
            <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: '#555' }}>Goal progress</Typography>
                    <Typography variant="caption" sx={{ color: '#858585' }}>{goal.progressPct.toString()}%</Typography>
                </Stack>
                <Box sx={{ height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <Box sx={{ width: `${goal.progressPct.toString()}%`, height: '100%', borderRadius: '999px', bgcolor: blockedTasks > 0 ? '#ff9800' : '#38c872' }} />
                </Box>
            </Stack>

            {/* Status pills */}
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
                {blockedTasks > 0 && <AIStatusPill label={`${blockedTasks} blocked`} tone="danger" />}
                {waitingTasks > 0 && <AIStatusPill label={`${waitingTasks} waiting approval`} tone="warning" />}
                {runningTasks > 0 && <AIStatusPill label={`${runningTasks} running`} tone="info" />}
                <AIStatusPill label={`${completedTasks}/${tasks.length} tasks done`} tone="neutral" />
            </Stack>

            {/* Detail info */}
            {goal.description && (
                <Typography variant="body2" sx={{ color: '#858585' }}>{goal.description}</Typography>
            )}
            <Typography variant="caption" sx={{ color: '#444' }}>
                Due {formatBigIntDateTime(goal.dueAt)} • Created {formatBigIntDateTime(goal.createdAt)}
            </Typography>

            {/* Tasks */}
            {tasks.length > 0 && (
                <AISectionCard title="Linked tasks" description={`${tasks.length} task${tasks.length !== 1 ? 's' : ''} contributing to this goal`}>
                    <Stack spacing={0}>
                        {tasks.slice(0, 10).map((task, i) => (
                            <Stack
                                key={task.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    py: 1,
                                    borderBottom: i < tasks.length - 1 ? '1px solid #111' : 'none',
                                }}
                            >
                                <Stack spacing={0.1}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{task.title}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{task.status} • {task.priority} • {formatRelativeTime(task.updatedAt)}</Typography>
                                </Stack>
                                <AIStatusPill label={task.status} tone={task.status === 'completed' ? 'success' : task.status === 'blocked' || task.status === 'failed' ? 'danger' : 'neutral'} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            )}

            {/* Goal tree */}
            <AISectionCard title="Goal tree">
                <AiGoalTree
                    goals={[goal]}
                    projects={project ? [project] : []}
                    tasks={tasks}
                    onGoalClick={(_id) => {}}
                    onProjectClick={(_id) => {}}
                />
            </AISectionCard>
        </AIWorkspacePage>
    );
}

export const AiGoalDetailPage = AIGoalDetailPage;
