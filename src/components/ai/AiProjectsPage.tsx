import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { formatRelativeTime } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const projectStatuses = ['planning', 'active', 'watching', 'completed', 'paused'] as const;
type ProjectStatus = (typeof projectStatuses)[number];

const statusColor: Record<ProjectStatus, string> = {
    planning: '#555',
    active: '#38c872',
    watching: '#ff9800',
    completed: '#7eb0ff',
    paused: '#444',
};

type ProjectTab = 'all' | 'active' | 'watching' | 'planning' | 'completed';

const TABS: { value: ProjectTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'watching', label: 'Watching' },
    { value: 'planning', label: 'Planning' },
    { value: 'completed', label: 'Completed' },
];

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

    const [form, setForm] = useState({ name: '', summary: '', status: 'planning' });
    const [createOpen, setCreateOpen] = useState(false);
    const [tab, setTab] = useState<ProjectTab>('all');

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
                const blockedCount = projectTasks.filter((task) => ['blocked', 'failed'].includes(task.status)).length;

                return {
                    project,
                    owner: usersById.get(project.ownerUserId) ?? null,
                    agentCount: projectAgents.length,
                    goalCount: projectGoals.length,
                    taskCount: projectTasks.length,
                    blockedCount,
                    pendingApprovals,
                    taskCoverage,
                };
            }),
        [aiAgents, aiApprovals, aiGoals, aiProjects, aiTasks, usersById]
    );

    const filtered = useMemo(() => {
        if (tab === 'all') return portfolioRows;
        return portfolioRows.filter((r) => r.project.status === tab);
    }, [portfolioRows, tab]);

    const tabCount = (t: ProjectTab) => {
        if (t === 'all') return aiProjects.length;
        return aiProjects.filter((p) => p.status === t).length;
    };

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
            setCreateOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create project');
        }
    };

    return (
        <AIWorkspacePage page="projects">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Projects
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
                    New Project
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
                    {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                </Typography>
            )}

            {/* Project list */}
            {aiProjects.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>No projects yet.</Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{ mt: 2, textTransform: 'none', borderColor: '#1a1a1a', color: '#858585', '&:hover': { borderColor: '#333', color: '#fff', bgcolor: 'transparent' } }}
                        onClick={() => setCreateOpen(true)}
                    >
                        Create your first project
                    </Button>
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#555' }}>No projects match this filter.</Typography>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                    {filtered.map(({ project, owner, agentCount, goalCount, taskCount, blockedCount, pendingApprovals, taskCoverage }) => (
                        <Stack
                            key={project.id.toString()}
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
                                    bgcolor: statusColor[project.status as ProjectStatus] ?? '#444',
                                    flexShrink: 0,
                                }}
                            />

                            {/* Name + meta */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {project.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#555' }}>
                                    {agentCount} agent{agentCount !== 1 ? 's' : ''}
                                    {' • '}
                                    {goalCount} goal{goalCount !== 1 ? 's' : ''}
                                    {' • '}
                                    {taskCount} task{taskCount !== 1 ? 's' : ''}
                                    {blockedCount > 0 ? ` • ${blockedCount} blocked` : ''}
                                    {pendingApprovals > 0 ? ` • ${pendingApprovals} approvals pending` : ''}
                                    {' • '}
                                    {taskCoverage}% done
                                    {owner ? ` • ${owner.name || owner.email}` : ''}
                                    {' • '}
                                    {formatRelativeTime(project.updatedAt)}
                                </Typography>
                            </Box>

                            {/* Right */}
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                                <Chip
                                    size="small"
                                    label={project.status}
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: 20,
                                        bgcolor: 'transparent',
                                        color: statusColor[project.status as ProjectStatus] ?? '#555',
                                        border: '1px solid #1a1a1a',
                                        borderRadius: '4px',
                                    }}
                                />
                                {project.status !== 'completed' && (
                                    <Button
                                        size="small"
                                        variant="text"
                                        sx={{ textTransform: 'none', color: '#555', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                        onClick={() =>
                                            updateAiProjectStatus({
                                                projectId: project.id,
                                                status: project.status === 'active' ? 'watching' : 'active',
                                            }).catch((error) => {
                                                toast.error(error instanceof Error ? error.message : 'Failed to update project');
                                            })
                                        }
                                    >
                                        {project.status === 'active' ? 'Flag' : 'Activate'}
                                    </Button>
                                )}
                                <Button
                                    component="a"
                                    href={`/ai/projects/${project.id.toString()}`}
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

            {/* Create Project Dialog */}
            <Dialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                        New Project
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack component="form" spacing={1.4} id="create-project-form" onSubmit={handleCreateProject}>
                        <TextField
                            size="small"
                            label="Project name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Outbound automation rollout"
                            autoFocus
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
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </MenuItem>
                            ))}
                        </TextField>
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
                        form="create-project-form"
                        variant="contained"
                        disabled={currentOrgId == null || !form.name.trim()}
                        sx={{ textTransform: 'none' }}
                    >
                        Create project
                    </Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}

export const AiProjectsPage = AIProjectsPage;
