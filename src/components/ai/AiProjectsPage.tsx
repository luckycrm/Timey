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
import { formatRelativeTime } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const projectStatuses = ['planning', 'active', 'watching', 'completed', 'paused'] as const;

const statusConfig: Record<(typeof projectStatuses)[number], { title: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    planning: { title: 'Planning', tone: 'neutral' },
    active: { title: 'Active', tone: 'success' },
    watching: { title: 'Watching', tone: 'warning' },
    completed: { title: 'Completed', tone: 'info' },
    paused: { title: 'Paused', tone: 'neutral' },
};

export function AIProjectsPage() {
    const {
        currentOrgId,
        aiProjects,
        aiAgents,
        aiGoals,
        aiTasks,
        aiApprovals,
        usersById,
    } = useAIWorkspaceData();

    const createAiProject = useReducer(reducers.createAiProject);
    const updateAiProjectStatus = useReducer(reducers.updateAiProjectStatus);

    const [form, setForm] = useState({
        name: '',
        summary: '',
        status: 'planning',
    });

    const activeProjects = aiProjects.filter((project) => project.status === 'active');
    const atRiskProjects = aiProjects.filter((project) => project.status === 'watching');
    const staffedProjects = aiProjects.filter((project) => aiAgents.some((agent) => agent.projectId === project.id));
    const withGoals = aiProjects.filter((project) => aiGoals.some((goal) => goal.projectId === project.id));
    const projectsWithBlockedTasks = aiProjects.filter((project) => aiTasks.some((task) => task.projectId === project.id && ['blocked', 'failed'].includes(task.status)));

    const portfolioRows = useMemo(
        () => [...aiProjects]
            .sort((left, right) => Number(right.updatedAt - left.updatedAt))
            .map((project) => {
                const projectAgents = aiAgents.filter((agent) => agent.projectId === project.id);
                const projectGoals = aiGoals.filter((goal) => goal.projectId === project.id);
                const projectTasks = aiTasks.filter((task) => task.projectId === project.id);
                const projectTaskIds = new Set(projectTasks.map((task) => task.id));
                const pendingApprovals = aiApprovals.filter((approval) => projectTaskIds.has(approval.taskId) && approval.status === 'pending').length;
                const completedTasks = projectTasks.filter((task) => task.status === 'completed').length;
                const taskCoverage = projectTasks.length === 0 ? 0 : Math.round((completedTasks / projectTasks.length) * 100);

                return {
                    project,
                    owner: usersById.get(project.ownerUserId) ?? null,
                    agentCount: projectAgents.length,
                    goalCount: projectGoals.length,
                    taskCount: projectTasks.length,
                    blockedCount: projectTasks.filter((task) => ['blocked', 'failed'].includes(task.status)).length,
                    waitingApprovalCount: projectTasks.filter((task) => task.status === 'waiting_approval').length,
                    pendingApprovals,
                    taskCoverage,
                    recentUpdate: project.updatedAt,
                };
            }),
        [aiAgents, aiApprovals, aiGoals, aiProjects, aiTasks, usersById]
    );

    const portfolioByStatus = useMemo(
        () => projectStatuses.map((status) => ({
            status,
            label: statusConfig[status].title,
            tone: statusConfig[status].tone,
            rows: portfolioRows.filter((row) => row.project.status === status),
        })),
        [portfolioRows]
    );

    const highestAttentionProjects = useMemo(
        () => [...portfolioRows]
            .sort((left, right) => {
                const rightScore = right.blockedCount * 3 + right.waitingApprovalCount * 2 + (right.agentCount === 0 ? 2 : 0);
                const leftScore = left.blockedCount * 3 + left.waitingApprovalCount * 2 + (left.agentCount === 0 ? 2 : 0);
                return rightScore - leftScore || Number(right.project.updatedAt - left.project.updatedAt);
            })
            .slice(0, 5),
        [portfolioRows]
    );

    const handleCreateProject = async (event: React.FormEvent) => {
        event.preventDefault();
        if (currentOrgId == null) return;
        try {
            await createAiProject({
                orgId: currentOrgId,
                name: form.name.trim(),
                summary: form.summary.trim(),
                status: form.status,
            });
            setForm({ name: '', summary: '', status: 'planning' });
            toast.success('Project created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create project');
        }
    };

    return (
        <AIWorkspacePage page="projects">
            <AIPageIntro
                eyebrow="Projects"
                title="Track AI work as a portfolio"
                description="Projects are live workstreams now. Use this page to see where staffing is thin, where outcomes are attached, and which programs are drifting."
            />

            <AIStatGrid>
                <AIStatCard label="Active programs" value={String(activeProjects.length)} caption={`${aiProjects.length} total projects`} tone="info" />
                <AIStatCard label="Watching" value={String(atRiskProjects.length)} caption="Programs flagged for operator attention" tone="warning" />
                <AIStatCard label="Staffed" value={String(staffedProjects.length)} caption={`${withGoals.length} already have goals attached`} tone="success" />
                <AIStatCard label="Blocked workstreams" value={String(projectsWithBlockedTasks.length)} caption="Projects carrying blocked or failed tasks" tone="danger" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Board" title="Portfolio lanes" description="Projects are grouped by operating state so you can see drift and load quickly.">
                    <Stack spacing={1.4}>
                        {portfolioByStatus.map((group) => (
                            <Stack key={group.status} spacing={1}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {group.label}
                                        </Typography>
                                        <AIStatusPill label={`${group.rows.length}`} tone={group.tone} />
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {group.rows.length === 0 ? 'No projects here' : `${group.rows.length} project${group.rows.length === 1 ? '' : 's'}`}
                                    </Typography>
                                </Stack>
                                {group.rows.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#666666', lineHeight: 1.7 }}>
                                        Nothing is currently marked {group.label.toLowerCase()}.
                                    </Typography>
                                ) : (
                                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2} useFlexGap flexWrap="wrap">
                                        {group.rows.map((row) => (
                                            <Stack
                                                key={row.project.id.toString()}
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
                                                    <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                                            {row.project.name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                                            Owner {row.owner?.name || row.owner?.email || 'Unknown'} • updated {formatRelativeTime(row.recentUpdate)}
                                                        </Typography>
                                                    </Stack>
                                                    <AIStatusPill label={row.project.status} tone={group.tone} />
                                                </Stack>
                                                <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.6 }}>
                                                    {row.project.summary || 'No project summary yet.'}
                                                </Typography>
                                                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                                    <Typography variant="caption" sx={{ color: '#d7d7d7' }}>
                                                        {row.agentCount} agents
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#d7d7d7' }}>
                                                        {row.goalCount} goals
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#d7d7d7' }}>
                                                        {row.taskCount} tasks
                                                    </Typography>
                                                    {row.pendingApprovals > 0 ? (
                                                        <Typography variant="caption" sx={{ color: '#ffc47b' }}>
                                                            {row.pendingApprovals} approvals waiting
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                                <Box>
                                                    <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                                            Task completion
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                                            {row.taskCoverage}%
                                                        </Typography>
                                                    </Stack>
                                                    <Box sx={{ height: 8, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                                        <Box
                                                            sx={{
                                                                width: `${row.taskCoverage}%`,
                                                                height: '100%',
                                                                borderRadius: '999px',
                                                                bgcolor: row.blockedCount > 0 ? '#ff9800' : '#38c872',
                                                            }}
                                                        />
                                                    </Box>
                                                </Box>
                                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                    <Button size="small" variant="outlined" href={`/ai/projects/${row.project.id.toString()}`} sx={{ textTransform: 'none' }}>
                                                        Open detail
                                                    </Button>
                                                    {row.project.status !== 'completed' ? (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ textTransform: 'none' }}
                                                            onClick={() => updateAiProjectStatus({
                                                                projectId: row.project.id,
                                                                status: row.project.status === 'active' ? 'watching' : 'active',
                                                            }).catch((error) => {
                                                                toast.error(error instanceof Error ? error.message : 'Failed to update project');
                                                            })}
                                                        >
                                                            {row.project.status === 'active' ? 'Flag watch' : 'Mark active'}
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

                <AISectionCard eyebrow="Create" title="Add a project" description="Start with a workstream name, its purpose, and its current operating state.">
                    <Stack component="form" spacing={1.4} onSubmit={handleCreateProject}>
                        <TextField
                            size="small"
                            label="Project name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Outbound automation rollout"
                        />
                        <TextField
                            size="small"
                            label="Summary"
                            value={form.summary}
                            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                            multiline
                            minRows={3}
                            placeholder="Define the workstream, success condition, and what needs to happen next."
                        />
                        <TextField
                            select
                            size="small"
                            label="Status"
                            value={form.status}
                            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                        >
                            {projectStatuses.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {statusConfig[status].title}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Stack direction="row" justifyContent="flex-end">
                            <Button type="submit" variant="contained" disabled={currentOrgId == null} sx={{ textTransform: 'none' }}>
                                Create project
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Coverage" title="Portfolio health" description="Simple ratios across the current project set.">
                    <Stack spacing={1.6}>
                        <AIProgressRow label="Projects with agents assigned" value={aiProjects.length === 0 ? 0 : Math.round((staffedProjects.length / aiProjects.length) * 100)} detail={`${staffedProjects.length} staffed`} tone="info" />
                        <AIProgressRow label="Projects with goals attached" value={aiProjects.length === 0 ? 0 : Math.round((withGoals.length / aiProjects.length) * 100)} detail={`${withGoals.length} with goals`} tone="warning" />
                        <AIProgressRow label="Projects marked active" value={aiProjects.length === 0 ? 0 : Math.round((activeProjects.length / aiProjects.length) * 100)} detail={`${activeProjects.length} active`} tone="success" />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Attention" title="Programs needing intervention" description="Projects sorted by staffing gaps, blocked work, and approval drag.">
                    <Stack spacing={1.1}>
                        {highestAttentionProjects.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585' }}>
                                No projects exist yet.
                            </Typography>
                        ) : highestAttentionProjects.map((row) => (
                            <Stack key={row.project.id.toString()} spacing={0.3}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {row.project.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {row.agentCount === 0 ? 'No agents assigned' : `${row.agentCount} agents`} • {row.blockedCount} blocked tasks • {row.waitingApprovalCount} tasks waiting approval
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiProjectsPage = AIProjectsPage;
