import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import type { AiGoal, AiProject, AiTask } from '../../module_bindings/types';

export interface GoalTreeProps {
    goals: AiGoal[];
    projects: AiProject[];
    tasks: AiTask[];
    onGoalClick: (goalId: bigint) => void;
    onProjectClick: (projectId: bigint) => void;
}

const statusTone: Record<string, { border: string; text: string; soft: string; bar: string }> = {
    on_track: { border: 'rgba(56,200,114,0.34)', text: '#9de0b6', soft: 'rgba(56,200,114,0.08)', bar: '#38c872' },
    active:   { border: 'rgba(56,200,114,0.34)', text: '#9de0b6', soft: 'rgba(56,200,114,0.08)', bar: '#38c872' },
    watching: { border: 'rgba(255,152,0,0.34)', text: '#ffc47b', soft: 'rgba(255,152,0,0.08)', bar: '#ff9800' },
    paused:   { border: 'rgba(255,152,0,0.34)', text: '#ffc47b', soft: 'rgba(255,152,0,0.08)', bar: '#ff9800' },
    blocked:  { border: 'rgba(227,61,79,0.34)', text: '#f5a3ad', soft: 'rgba(227,61,79,0.08)', bar: '#e33d4f' },
    completed:{ border: 'rgba(116,167,255,0.35)', text: '#b9d1ff', soft: 'rgba(116,167,255,0.08)', bar: '#7eb0ff' },
    planning: { border: 'rgba(255,255,255,0.12)', text: '#d5d5d5', soft: 'rgba(255,255,255,0.04)', bar: '#858585' },
};

function ProjectNode({ project, tasks, onProjectClick }: { project: AiProject; tasks: AiTask[]; onProjectClick: (id: bigint) => void }) {
    const counts = {
        queued: tasks.filter((t) => t.status === 'queued').length,
        running: tasks.filter((t) => t.status === 'running').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        blocked: tasks.filter((t) => ['blocked', 'failed'].includes(t.status)).length,
    };
    return (
        <Box sx={{ ml: 3, pl: 1.5, borderLeft: '1px solid rgba(255,255,255,0.07)', py: 0.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }} onClick={() => onProjectClick(project.id)}>
                <FolderOpenOutlinedIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500 }}>{project.name}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 0.4, ml: 2.8 }} flexWrap="wrap" useFlexGap>
                {counts.queued > 0 && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>{counts.queued} queued</Typography>}
                {counts.running > 0 && <Typography variant="caption" sx={{ color: '#b9d1ff', fontSize: '0.68rem' }}>{counts.running} running</Typography>}
                {counts.blocked > 0 && <Typography variant="caption" sx={{ color: '#ffc47b', fontSize: '0.68rem' }}>{counts.blocked} blocked</Typography>}
                {counts.completed > 0 && <Typography variant="caption" sx={{ color: '#9de0b6', fontSize: '0.68rem' }}>{counts.completed} done</Typography>}
                {tasks.length === 0 && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>No tasks</Typography>}
            </Stack>
        </Box>
    );
}

function GoalNode({ goal, linkedProjects, tasks, onGoalClick, onProjectClick }: {
    goal: AiGoal; linkedProjects: AiProject[]; tasks: AiTask[];
    onGoalClick: (id: bigint) => void; onProjectClick: (id: bigint) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const tone = statusTone[goal.status] ?? statusTone['planning'];
    const progressPct = typeof goal.progressPct === 'bigint' ? Number(goal.progressPct) : Number(goal.progressPct ?? 0);

    return (
        <Box sx={{ borderRadius: '10px', border: `1px solid ${tone.border}`, bgcolor: tone.soft, overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ px: 1.5, pt: 1.25, pb: linkedProjects.length > 0 && expanded ? 0.75 : 1.25 }}>
                <IconButton size="small" onClick={() => setExpanded((v) => !v)}
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', visibility: linkedProjects.length > 0 ? 'visible' : 'hidden', mt: 0.1 }}>
                    {expanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <FlagOutlinedIcon sx={{ fontSize: 13, color: tone.text }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => onGoalClick(goal.id)}>
                                {goal.title}
                            </Typography>
                        </Stack>
                        <Chip size="small" label={goal.status.replace(/_/g, ' ')}
                            sx={{ borderRadius: '6px', border: `1px solid ${tone.border}`, bgcolor: 'transparent', color: tone.text, fontWeight: 600, fontSize: '0.65rem', height: 20, flexShrink: 0 }} />
                    </Stack>
                    <Box sx={{ mt: 0.9 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.66rem' }}>Progress</Typography>
                            <Typography variant="caption" sx={{ color: tone.text, fontSize: '0.66rem', fontWeight: 600 }}>{progressPct}%</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, progressPct))}
                            sx={{ height: 5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: tone.bar } }} />
                    </Box>
                </Box>
            </Stack>
            {linkedProjects.length > 0 && (
                <Collapse in={expanded}>
                    <Box sx={{ pb: 1 }}>
                        {linkedProjects.map((p) => (
                            <ProjectNode key={p.id.toString()} project={p}
                                tasks={tasks.filter((t) => t.projectId === p.id && t.goalId === goal.id)}
                                onProjectClick={onProjectClick} />
                        ))}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
}

export function AiGoalTree({ goals, projects, tasks, onGoalClick, onProjectClick }: GoalTreeProps) {
    if (goals.length === 0) {
        return <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>No goals to display.</Typography>;
    }
    return (
        <Stack spacing={1.2}>
            {goals.map((goal) => (
                <GoalNode key={goal.id.toString()} goal={goal}
                    linkedProjects={projects.filter((p) => p.id === goal.projectId)}
                    tasks={tasks}
                    onGoalClick={onGoalClick}
                    onProjectClick={onProjectClick} />
            ))}
        </Stack>
    );
}
