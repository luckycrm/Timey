import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { formatRelativeTime, NONE_U64 } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type BoardFilter = 'unassigned' | 'assigned' | 'all';

const FILTER_TABS: { value: BoardFilter; label: string }[] = [
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'all', label: 'All queued' },
];

const priorityColor = (p: string) =>
    p === 'urgent' ? '#e33d4f' : p === 'high' ? '#ff9800' : '#555';

export function AIBoardPage() {
    const {
        currentOrgId,
        aiTasks,
        aiAgents,
        aiProjects,
        aiGoals,
    } = useAIWorkspaceData();

    const createAiRun = useReducer(reducers.createAiRun);
    const updateAiTaskStatus = useReducer(reducers.updateAiTaskStatus);

    const [filter, setFilter] = useState<BoardFilter>('unassigned');
    const [claimDialogTask, setClaimDialogTask] = useState<(typeof aiTasks)[0] | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('0');
    const [claiming, setClaiming] = useState(false);

    const now = Date.now();

    // Only show queued tasks on the board
    const queuedTasks = useMemo(
        () => aiTasks.filter((t) => t.status === 'queued'),
        [aiTasks]
    );

    const filtered = useMemo(() => {
        return queuedTasks.filter((t) => {
            if (filter === 'unassigned') return t.agentId === NONE_U64 || t.agentId === 0n;
            if (filter === 'assigned') return t.agentId !== NONE_U64 && t.agentId !== 0n;
            return true;
        });
    }, [filter, queuedTasks]);

    const tabCount = (f: BoardFilter) => {
        if (f === 'unassigned') return queuedTasks.filter((t) => t.agentId === NONE_U64 || t.agentId === 0n).length;
        if (f === 'assigned') return queuedTasks.filter((t) => t.agentId !== NONE_U64 && t.agentId !== 0n).length;
        return queuedTasks.length;
    };

    const handleOpenClaim = (task: (typeof aiTasks)[0]) => {
        const defaultAgent = task.agentId !== NONE_U64 && task.agentId !== 0n ? task.agentId.toString() : '0';
        setSelectedAgentId(defaultAgent);
        setClaimDialogTask(task);
    };

    const handleClaim = async () => {
        if (claimDialogTask == null || currentOrgId == null) return;
        const agentId = BigInt(selectedAgentId);
        setClaiming(true);
        try {
            await updateAiTaskStatus({ taskId: claimDialogTask.id, status: 'running' });
            await createAiRun({
                orgId: currentOrgId,
                taskId: claimDialogTask.id,
                agentId: agentId === 0n ? NONE_U64 : agentId,
                status: 'running',
                triggerType: 'manual',
                summary: 'Dispatched from board',
                errorMessage: '',
                tokenInput: 0n,
                tokenOutput: 0n,
                toolCalls: 0n,
                costMicrousd: 0n,
            });
            toast.success('Task dispatched');
            setClaimDialogTask(null);
        } catch (error) {
            // Roll back status if run creation failed
            await updateAiTaskStatus({ taskId: claimDialogTask.id, status: 'queued' }).catch(() => {});
            toast.error(error instanceof Error ? error.message : 'Failed to dispatch task');
        } finally {
            setClaiming(false);
        }
    };

    // Group by project for display
    const byProject = useMemo(() => {
        const grouped = new Map<string, { label: string; tasks: typeof filtered }>();
        for (const task of filtered) {
            const project = aiProjects.find((p) => p.id === task.projectId);
            const key = project ? project.id.toString() : 'none';
            const label = project ? project.name : 'No project';
            const existing = grouped.get(key) ?? { label, tasks: [] };
            existing.tasks.push(task);
            grouped.set(key, existing);
        }
        return [...grouped.values()].sort((a, b) => b.tasks.length - a.tasks.length);
    }, [aiProjects, filtered]);

    return (
        <AIWorkspacePage page="board">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack spacing={0.25}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                        Board
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#555' }}>
                        Claim and dispatch queued tasks to agents. Each task is atomic — dispatching it removes it from the queue.
                    </Typography>
                </Stack>
                {queuedTasks.length > 0 && (
                    <Typography variant="caption" sx={{ color: '#ff9800', flexShrink: 0 }}>
                        {queuedTasks.length} in queue
                    </Typography>
                )}
            </Stack>

            {/* Filter tabs */}
            <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid #1a1a1a', mt: -0.5 }}>
                {FILTER_TABS.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => setFilter(t.value)}
                        style={{
                            padding: '6px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: filter === t.value ? '#ffffff' : '#555',
                            borderBottom: filter === t.value ? '2px solid #ffffff' : '2px solid transparent',
                            fontSize: '0.8rem',
                            fontWeight: filter === t.value ? 600 : 400,
                            transition: 'color 0.15s',
                        }}
                    >
                        {t.label}
                        {tabCount(t.value) > 0 && (
                            <span style={{ marginLeft: 5, fontSize: '0.7rem', color: filter === t.value ? '#858585' : '#444' }}>
                                {tabCount(t.value)}
                            </span>
                        )}
                    </button>
                ))}
            </Stack>

            {/* Empty states */}
            {queuedTasks.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>Queue is empty — no tasks waiting for dispatch.</Typography>
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1, py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>No tasks match this filter.</Typography>
                </Box>
            ) : (
                /* Grouped by project */
                <Stack spacing={1.5}>
                    {byProject.map(({ label, tasks }) => (
                        <Box key={label} sx={{ border: '1px solid #1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                            {/* Project header */}
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ px: 2, py: 1, borderBottom: '1px solid #1a1a1a', bgcolor: 'rgba(255,255,255,0.02)' }}
                            >
                                <Typography variant="body2" sx={{ color: '#858585', fontWeight: 600 }}>{label}</Typography>
                                <Typography variant="caption" sx={{ color: '#444' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Typography>
                            </Stack>

                            {/* Task rows */}
                            {tasks.map((task, i) => {
                                const agent = task.agentId !== NONE_U64 && task.agentId !== 0n
                                    ? aiAgents.find((a) => a.id === task.agentId) ?? null
                                    : null;
                                const goal = task.goalId !== NONE_U64 && task.goalId !== 0n
                                    ? aiGoals.find((g) => g.id === task.goalId) ?? null
                                    : null;

                                return (
                                    <Stack
                                        key={task.id.toString()}
                                        direction="row"
                                        alignItems="center"
                                        spacing={2}
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            borderBottom: i < tasks.length - 1 ? '1px solid #1a1a1a' : 'none',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                        }}
                                    >
                                        {/* Priority dot */}
                                        <Box
                                            sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                bgcolor: priorityColor(task.priority),
                                                flexShrink: 0,
                                            }}
                                        />

                                        {/* Title + meta */}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                                {task.title}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#555' }}>
                                                {goal ? `${goal.title} · ` : ''}
                                                queued {formatRelativeTime(task.createdAt, now)}
                                                {agent ? null : ' · unassigned'}
                                            </Typography>
                                        </Box>

                                        {/* Right */}
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                                            <Chip
                                                size="small"
                                                label={task.priority}
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    height: 20,
                                                    bgcolor: 'transparent',
                                                    color: priorityColor(task.priority),
                                                    border: '1px solid #1a1a1a',
                                                    borderRadius: '4px',
                                                }}
                                            />
                                            {agent && (
                                                <Typography variant="caption" sx={{ color: '#555', fontFamily: 'monospace' }}>
                                                    {agent.name}
                                                </Typography>
                                            )}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleOpenClaim(task)}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontSize: '0.75rem',
                                                    borderColor: '#1a1a1a',
                                                    color: '#858585',
                                                    minWidth: 0,
                                                    px: 1.2,
                                                    '&:hover': { borderColor: '#fff', color: '#fff', bgcolor: 'transparent' },
                                                }}
                                            >
                                                {agent ? 'Dispatch' : 'Assign & run'}
                                            </Button>
                                            <Button
                                                component="a"
                                                href={`/ai/tasks/${task.id.toString()}`}
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
                    ))}
                </Stack>
            )}

            {/* Claim / dispatch dialog */}
            <Dialog
                open={claimDialogTask != null}
                onClose={() => !claiming && setClaimDialogTask(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                        Dispatch task
                    </Typography>
                    {claimDialogTask && (
                        <Typography variant="body2" sx={{ color: '#858585', mt: 0.5 }}>
                            {claimDialogTask.title}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack spacing={1.5}>
                        <Typography variant="caption" sx={{ color: '#555' }}>
                            Select an agent to run this task. This will set the task to "running" and create a new run record.
                        </Typography>
                        <TextField
                            select
                            size="small"
                            label="Agent"
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            fullWidth
                        >
                            <MenuItem value="0">— Pick an agent —</MenuItem>
                            {aiAgents
                                .filter((a) => a.status !== 'terminated')
                                .map((a) => (
                                    <MenuItem key={a.id.toString()} value={a.id.toString()}>
                                        {a.name}
                                        {a.status !== 'active' ? ` (${a.status})` : ''}
                                    </MenuItem>
                                ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1a1a1a' }}>
                    <Button
                        variant="text"
                        onClick={() => setClaimDialogTask(null)}
                        disabled={claiming}
                        sx={{ textTransform: 'none', color: '#555' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={claiming || selectedAgentId === '0'}
                        onClick={handleClaim}
                        sx={{ textTransform: 'none' }}
                    >
                        {claiming ? 'Dispatching…' : 'Dispatch'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}

export const AiBoardPage = AIBoardPage;
