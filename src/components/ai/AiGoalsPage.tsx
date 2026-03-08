import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const goalStatuses = ['on_track', 'watching', 'blocked', 'completed'] as const;

const statusConfig: Record<(typeof goalStatuses)[number], { title: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    on_track: { title: 'On track', tone: 'success' },
    watching: { title: 'Watching', tone: 'warning' },
    blocked: { title: 'Blocked', tone: 'danger' },
    completed: { title: 'Completed', tone: 'info' },
};

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

    const onTrackGoals = aiGoals.filter((goal) => goal.status === 'on_track');
    const watchingGoals = aiGoals.filter((goal) => goal.status === 'watching');
    const blockedGoals = aiGoals.filter((goal) => goal.status === 'blocked');
    const completedGoals = aiGoals.filter((goal) => goal.status === 'completed');

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

    const board = useMemo(
        () => goalStatuses.map((status) => ({
            status,
            label: statusConfig[status].title,
            tone: statusConfig[status].tone,
            rows: goalRows.filter((row) => row.goal.status === status),
        })),
        [goalRows]
    );

    const groupedByProject = useMemo(
        () => {
            const withProject = aiProjects
                .map((project) => ({
                    project,
                    goals: goalRows.filter((row) => row.project?.id === project.id),
                }))
                .filter((entry) => entry.goals.length > 0);

            const unlinked = goalRows.filter((row) => row.project == null || row.goal.projectId === NONE_U64);
            return { withProject, unlinked };
        },
        [aiProjects, goalRows]
    );

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
            setForm({
                title: '',
                description: '',
                projectId: form.projectId,
                status: 'watching',
                progressPct: '25',
                dueAt: '',
            });
            toast.success('Goal created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create goal');
        }
    };

    return (
        <AIWorkspacePage page="goals">
            <AIPageIntro
                eyebrow="Goals"
                title="Tie AI work to outcomes"
                description="Goals are live outcome records. Use this page to see whether work is on track, drifting, blocked, or already closed."
            />

            <AIStatGrid>
                <AIStatCard label="Goals on track" value={String(onTrackGoals.length)} caption={`${aiGoals.length} total goals`} tone="success" />
                <AIStatCard label="Watching" value={String(watchingGoals.length)} caption="Needs more momentum" tone="warning" />
                <AIStatCard label="Blocked" value={String(blockedGoals.length)} caption="Requires intervention" tone="danger" />
                <AIStatCard label="Completed" value={String(completedGoals.length)} caption="Closed out outcomes" tone="info" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Board" title="Outcome board" description="Grouped by goal status so blocked and drifting outcomes surface immediately.">
                    <Stack spacing={1.4}>
                        {board.map((group) => (
                            <Stack key={group.status} spacing={1}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {group.label}
                                        </Typography>
                                        <AIStatusPill label={`${group.rows.length}`} tone={group.tone} />
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {group.rows.length === 0 ? 'No goals here' : `${group.rows.length} goal${group.rows.length === 1 ? '' : 's'}`}
                                    </Typography>
                                </Stack>
                                {group.rows.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#666666', lineHeight: 1.7 }}>
                                        Nothing is currently marked {group.label.toLowerCase()}.
                                    </Typography>
                                ) : (
                                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2} useFlexGap flexWrap="wrap">
                                        {group.rows.map(({ goal, owner, project, runningTasks, blockedTasks, waitingTasks, linkedTasks }) => (
                                            <Stack
                                                key={goal.id.toString()}
                                                spacing={1}
                                                sx={{
                                                    p: 1.5,
                                                    borderRadius: '14px',
                                                    border: '1px solid #1a1a1a',
                                                    bgcolor: 'rgba(255,255,255,0.015)',
                                                    minWidth: { xs: '100%', xl: 'calc(50% - 6px)' },
                                                    flex: 1,
                                                }}
                                            >
                                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                    <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                                            {goal.title}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                                            {project?.name || 'No project'} • {owner?.name || owner?.email || 'Unknown owner'}
                                                        </Typography>
                                                    </Stack>
                                                    <AIStatusPill label={`${goal.progressPct.toString()}%`} tone="info" />
                                                </Stack>
                                                <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.6 }}>
                                                    {goal.description || 'No goal description yet.'}
                                                </Typography>
                                                <Box>
                                                    <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                                            Progress
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                                            {goal.progressPct.toString()}%
                                                        </Typography>
                                                    </Stack>
                                                    <Box sx={{ height: 8, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                                        <Box sx={{ width: `${goal.progressPct.toString()}%`, height: '100%', borderRadius: '999px', bgcolor: blockedTasks > 0 ? '#ff9800' : '#38c872' }} />
                                                    </Box>
                                                </Box>
                                                <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
                                                    <Typography variant="caption" sx={{ color: '#d7d7d7' }}>
                                                        {linkedTasks.length} tasks
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#d7d7d7' }}>
                                                        {runningTasks} running
                                                    </Typography>
                                                    {blockedTasks > 0 ? <Typography variant="caption" sx={{ color: '#ffc47b' }}>{blockedTasks} blocked</Typography> : null}
                                                    {waitingTasks > 0 ? <Typography variant="caption" sx={{ color: '#ffc47b' }}>{waitingTasks} waiting approval</Typography> : null}
                                                </Stack>
                                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                    <Button size="small" variant="outlined" href={`/ai/goals/${goal.id.toString()}`} sx={{ textTransform: 'none' }}>
                                                        Open detail
                                                    </Button>
                                                    {goal.status !== 'completed' ? (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ textTransform: 'none' }}
                                                            onClick={() => updateAiGoalProgress({
                                                                goalId: goal.id,
                                                                progressPct: BigInt(Math.min(100, Number(goal.progressPct) + 10)),
                                                                status: Number(goal.progressPct) + 10 >= 100 ? 'completed' : goal.status,
                                                            }).catch((error) => {
                                                                toast.error(error instanceof Error ? error.message : 'Failed to update goal');
                                                            })}
                                                        >
                                                            Advance +10%
                                                        </Button>
                                                    ) : null}
                                                </Stack>
                                            </Stack>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Create" title="Add a goal" description="Capture the outcome, link it to a project if needed, and set the initial progress. ">
                    <Stack component="form" spacing={1.4} onSubmit={handleCreateGoal}>
                        <TextField
                            size="small"
                            label="Goal title"
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Reduce proposal turnaround time"
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
                                sx={{ minWidth: 180 }}
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
                                sx={{ minWidth: 160 }}
                            >
                                {goalStatuses.map((status) => (
                                    <MenuItem key={status} value={status}>
                                        {statusConfig[status].title}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Progress %"
                                type="number"
                                value={form.progressPct}
                                onChange={(event) => setForm((current) => ({ ...current, progressPct: event.target.value }))}
                                sx={{ minWidth: 140 }}
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
                        <Stack direction="row" justifyContent="flex-end">
                            <Button type="submit" variant="contained" disabled={currentOrgId == null} sx={{ textTransform: 'none' }}>
                                Create goal
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Roadmap" title="Goal coverage by project" description="See which projects actually have outcomes attached and which goals are still unlinked.">
                    <Stack spacing={1.2}>
                        {groupedByProject.withProject.map(({ project, goals }) => (
                            <Stack key={project.id.toString()} spacing={0.5}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {project.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {goals.length} goals • avg progress {Math.round(goals.reduce((sum, row) => sum + Number(row.goal.progressPct), 0) / goals.length)}%
                                </Typography>
                            </Stack>
                        ))}
                        {groupedByProject.unlinked.length > 0 ? (
                            <Stack spacing={0.4}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    Unlinked goals
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {groupedByProject.unlinked.length} goals are not attached to a project yet.
                                </Typography>
                            </Stack>
                        ) : null}
                        {groupedByProject.withProject.length === 0 && groupedByProject.unlinked.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No goals exist yet.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Pressure" title="Where to intervene next" description="Goal stack signals that deserve a manager decision first.">
                    <Stack spacing={1.6}>
                        <AIProgressRow label="Goals linked to a project" value={aiGoals.length === 0 ? 0 : Math.round((aiGoals.filter((goal) => goal.projectId !== NONE_U64).length / aiGoals.length) * 100)} detail={`${aiGoals.filter((goal) => goal.projectId !== NONE_U64).length} linked`} tone="info" />
                        <AIProgressRow label="Goals blocked" value={aiGoals.length === 0 ? 0 : Math.round((blockedGoals.length / aiGoals.length) * 100)} detail={`${blockedGoals.length} blocked`} tone="danger" />
                        <AIProgressRow label="Goals completed" value={aiGoals.length === 0 ? 0 : Math.round((completedGoals.length / aiGoals.length) * 100)} detail={`${completedGoals.length} completed`} tone="success" />
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiGoalsPage = AIGoalsPage;
