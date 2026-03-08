import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIGoalDetailPage({ goalId }: { goalId: string }) {
    const parsedId = safeParseBigInt(goalId);
    const {
        aiGoals,
        aiProjects,
        aiTasks,
        usersById,
    } = useAIWorkspaceData();

    const updateAiGoalProgress = useReducer(reducers.updateAiGoalProgress);

    const goal = parsedId == null ? null : aiGoals.find((row) => row.id === parsedId) ?? null;
    const project = goal ? aiProjects.find((row) => row.id === goal.projectId) ?? null : null;
    const owner = goal ? usersById.get(goal.ownerUserId) ?? null : null;
    const tasks = goal ? aiTasks.filter((row) => row.goalId === goal.id) : [];

    if (!goal) {
        return (
            <AIWorkspacePage page="goals">
                <AIPageIntro
                    eyebrow="Goals"
                    title="Goal not found"
                    description="The requested goal does not exist in this workspace or the id is invalid."
                    actionSlot={
                        <Button component={Link} to="/ai/goals" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back to goals
                        </Button>
                    }
                />
            </AIWorkspacePage>
        );
    }

    const runningTasks = tasks.filter((task) => task.status === 'running').length;
    const blockedTasks = tasks.filter((task) => ['blocked', 'failed'].includes(task.status)).length;
    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const waitingTasks = tasks.filter((task) => task.status === 'waiting_approval').length;
    const taskCompletionPct = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

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

    return (
        <AIWorkspacePage page="goals">
            <AIPageIntro
                eyebrow="Goal detail"
                title={goal.title}
                description={goal.description || 'No goal description yet.'}
                supportingCopy={`${project?.name || 'No project'} • Owner ${owner?.name || owner?.email || 'Unknown'} • updated ${formatRelativeTime(goal.updatedAt)}`}
                actionSlot={
                    <Stack direction="row" spacing={1}>
                        {goal.status !== 'completed' ? (
                            <Button variant="contained" sx={{ textTransform: 'none' }} onClick={handleAdvance}>
                                Advance +10%
                            </Button>
                        ) : null}
                        <Button component={Link} to="/ai/goals" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back
                        </Button>
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Status" value={goal.status} caption="Current goal state" tone={goal.status === 'on_track' ? 'success' : goal.status === 'blocked' ? 'danger' : goal.status === 'completed' ? 'info' : 'warning'} />
                <AIStatCard label="Progress" value={`${goal.progressPct.toString()}%`} caption="Recorded goal progress" tone="info" />
                <AIStatCard label="Project" value={project?.name || 'Unlinked'} caption="Parent workstream" tone="neutral" />
                <AIStatCard label="Task completion" value={`${taskCompletionPct}%`} caption={`${completedTasks}/${tasks.length} tasks complete`} tone="warning" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Status" title="Outcome profile" description="Current lifecycle, timing, and signals around this goal.">
                    <Stack spacing={1.2}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <AIStatusPill label={goal.status} tone={goal.status === 'on_track' ? 'success' : goal.status === 'blocked' ? 'danger' : goal.status === 'completed' ? 'info' : 'warning'} />
                            {blockedTasks > 0 ? <AIStatusPill label={`${blockedTasks} blocked tasks`} tone="danger" /> : null}
                            {waitingTasks > 0 ? <AIStatusPill label={`${waitingTasks} waiting approval`} tone="warning" /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            Due {formatBigIntDateTime(goal.dueAt)} • Updated {formatBigIntDateTime(goal.updatedAt)}
                        </Typography>
                        <Box>
                            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                                <Typography variant="caption" sx={{ color: '#666666' }}>
                                    Goal progress
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {goal.progressPct.toString()}%
                                </Typography>
                            </Stack>
                            <Box sx={{ height: 8, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <Box sx={{ width: `${goal.progressPct.toString()}%`, height: '100%', borderRadius: '999px', bgcolor: blockedTasks > 0 ? '#ff9800' : '#38c872' }} />
                            </Box>
                        </Box>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Execution" title="Task contribution" description="How the task lane is helping or hurting the goal.">
                    <Stack spacing={1.6}>
                        <AIProgressRow label="Tasks completed" value={taskCompletionPct} detail={`${completedTasks} completed`} tone="success" />
                        <AIProgressRow label="Tasks running" value={tasks.length === 0 ? 0 : Math.round((runningTasks / tasks.length) * 100)} detail={`${runningTasks} running`} tone="info" />
                        <AIProgressRow label="Tasks blocked" value={tasks.length === 0 ? 0 : Math.round((blockedTasks / tasks.length) * 100)} detail={`${blockedTasks} blocked`} tone="danger" />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Task lane" title="Linked tasks" description="Tasks currently contributing to this goal.">
                    <Stack spacing={1}>
                        {tasks.slice(0, 8).map((task) => (
                            <Stack key={task.id.toString()} spacing={0.25}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {task.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {task.status} • {task.priority} • updated {formatRelativeTime(task.updatedAt)}
                                </Typography>
                            </Stack>
                        ))}
                        {tasks.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No tasks are linked to this goal yet.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiGoalDetailPage = AIGoalDetailPage;
