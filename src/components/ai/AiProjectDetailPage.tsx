import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime, safeParseBigInt } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

export function AIProjectDetailPage({ projectId }: { projectId: string }) {
    const parsedId = safeParseBigInt(projectId);
    const {
        aiProjects,
        aiAgents,
        aiGoals,
        aiTasks,
        aiApprovals,
        usersById,
    } = useAIWorkspaceData();

    const project = parsedId == null ? null : aiProjects.find((row) => row.id === parsedId) ?? null;
    const owner = project ? usersById.get(project.ownerUserId) ?? null : null;
    const agents = project ? aiAgents.filter((row) => row.projectId === project.id) : [];
    const goals = project ? aiGoals.filter((row) => row.projectId === project.id) : [];
    const tasks = project ? aiTasks.filter((row) => row.projectId === project.id) : [];
    const approvals = project ? aiApprovals.filter((row) => tasks.some((task) => task.id === row.taskId)) : [];

    if (!project) {
        return (
            <AIWorkspacePage page="projects">
                <AIPageIntro
                    eyebrow="Projects"
                    title="Project not found"
                    description="The requested project does not exist in this workspace or the id is invalid."
                    actionSlot={
                        <Button component={Link} to="/ai/projects" variant="outlined" sx={{ textTransform: 'none' }}>
                            Back to projects
                        </Button>
                    }
                />
            </AIWorkspacePage>
        );
    }

    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const blockedTasks = tasks.filter((task) => ['blocked', 'failed'].includes(task.status));
    const waitingApprovalTasks = tasks.filter((task) => task.status === 'waiting_approval');
    const runningTasks = tasks.filter((task) => task.status === 'running');
    const taskCompletionPct = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
    const averageGoalProgress = goals.length === 0 ? 0 : Math.round(goals.reduce((sum, goal) => sum + Number(goal.progressPct), 0) / goals.length);

    const recentTasks = [...tasks]
        .sort((left, right) => Number(right.updatedAt - left.updatedAt))
        .slice(0, 6);

    const goalsByStatus = [
        { label: 'On track', count: goals.filter((goal) => goal.status === 'on_track').length, tone: 'success' as const },
        { label: 'Watching', count: goals.filter((goal) => goal.status === 'watching').length, tone: 'warning' as const },
        { label: 'Blocked', count: goals.filter((goal) => goal.status === 'blocked').length, tone: 'danger' as const },
    ];

    return (
        <AIWorkspacePage page="projects">
            <AIPageIntro
                eyebrow="Project detail"
                title={project.name}
                description={project.summary || 'No project summary yet.'}
                supportingCopy={`Owner ${owner?.name || owner?.email || 'Unknown'} • Updated ${formatRelativeTime(project.updatedAt)}`}
                actionSlot={
                    <Button component={Link} to="/ai/projects" variant="outlined" sx={{ textTransform: 'none' }}>
                        Back
                    </Button>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Status" value={project.status} caption="Current project state" tone={project.status === 'active' ? 'success' : project.status === 'watching' ? 'warning' : 'neutral'} />
                <AIStatCard label="Agents" value={String(agents.length)} caption="Assigned to this project" tone="info" />
                <AIStatCard label="Goal progress" value={`${averageGoalProgress}%`} caption={`${goals.length} linked goals`} tone="success" />
                <AIStatCard label="Task completion" value={`${taskCompletionPct}%`} caption={`${completedTasks}/${tasks.length} tasks complete`} tone="warning" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Health" title="Project health" description="A concise read of staffing, outcomes, and execution pressure.">
                    <Stack spacing={1.3}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <AIStatusPill label={project.status} tone={project.status === 'active' ? 'success' : project.status === 'watching' ? 'warning' : 'neutral'} />
                            {blockedTasks.length > 0 ? <AIStatusPill label={`${blockedTasks.length} blocked tasks`} tone="danger" /> : null}
                            {waitingApprovalTasks.length > 0 ? <AIStatusPill label={`${waitingApprovalTasks.length} waiting approval`} tone="warning" /> : null}
                            {approvals.filter((approval) => approval.status === 'pending').length > 0 ? <AIStatusPill label={`${approvals.filter((approval) => approval.status === 'pending').length} pending approvals`} tone="warning" /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            Created {formatBigIntDateTime(project.createdAt)} • Updated {formatBigIntDateTime(project.updatedAt)}
                        </Typography>
                        <Box>
                            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                                <Typography variant="caption" sx={{ color: '#666666' }}>
                                    Task completion
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {taskCompletionPct}%
                                </Typography>
                            </Stack>
                            <Box sx={{ height: 8, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <Box sx={{ width: `${taskCompletionPct}%`, height: '100%', borderRadius: '999px', bgcolor: blockedTasks.length > 0 ? '#ff9800' : '#38c872' }} />
                            </Box>
                        </Box>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Staffing" title="Assigned agents" description="Agents currently attached to this project.">
                    <Stack spacing={1}>
                        {agents.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No agents are assigned to this project yet.
                            </Typography>
                        ) : agents.map((agent) => (
                            <Stack key={agent.id.toString()} direction="row" justifyContent="space-between" spacing={1}>
                                <Stack spacing={0.25}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {agent.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {agent.role} • {agent.department}
                                    </Typography>
                                </Stack>
                                <AIStatusPill label={agent.status} tone={agent.status === 'active' ? 'success' : agent.status === 'attention' ? 'warning' : 'neutral'} />
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Goals" title="Outcome stack" description="The goal mix attached to this workstream.">
                    <Stack spacing={1.4}>
                        {goalsByStatus.map((group) => (
                            <AIProgressRow
                                key={group.label}
                                label={group.label}
                                value={goals.length === 0 ? 0 : Math.round((group.count / goals.length) * 100)}
                                detail={`${group.count} goals`}
                                tone={group.tone}
                            />
                        ))}
                        <Stack spacing={1}>
                            {goals.slice(0, 6).map((goal) => (
                                <Stack key={goal.id.toString()} spacing={0.3}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {goal.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {goal.status} • {goal.progressPct.toString()}% • due {formatBigIntDateTime(goal.dueAt)}
                                    </Typography>
                                </Stack>
                            ))}
                            {goals.length === 0 ? (
                                <Typography variant="body2" sx={{ color: '#858585' }}>
                                    No goals are linked to this project yet.
                                </Typography>
                            ) : null}
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Execution" title="Task lane" description="Where the project is moving or stuck right now.">
                    <Stack spacing={1.2}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {runningTasks.length} running • {waitingApprovalTasks.length} waiting approval • {blockedTasks.length} blocked or failed
                        </Typography>
                        <Stack spacing={1}>
                            {recentTasks.map((task) => (
                                <Stack key={task.id.toString()} spacing={0.25}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {task.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {task.status} • {task.priority} • updated {formatRelativeTime(task.updatedAt)}
                                    </Typography>
                                </Stack>
                            ))}
                            {recentTasks.length === 0 ? (
                                <Typography variant="body2" sx={{ color: '#858585' }}>
                                    No tasks are linked to this project yet.
                                </Typography>
                            ) : null}
                        </Stack>
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiProjectDetailPage = AIProjectDetailPage;
