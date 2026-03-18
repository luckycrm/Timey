// Port of KanbanBoard from paperclip, adapted to use MUI — no drag-and-drop, visual grouping only.

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AiPriorityIcon from './AiPriorityIcon';
import AiStatusBadge from './AiStatusBadge';

// Typed loosely to avoid regeneration dependency — matches SpacetimeDB ai_task row shape
interface AiTaskRow {
  id: bigint;
  title: string;
  status: string;
  priority: string;
  agentId: bigint;
}

const BOARD_COLUMNS: { status: string; label: string }[] = [
  { status: 'queued',           label: 'Queued'           },
  { status: 'running',          label: 'Running'          },
  { status: 'waiting_approval', label: 'Waiting Approval' },
  { status: 'blocked',          label: 'Blocked'          },
  { status: 'completed',        label: 'Completed'        },
  { status: 'failed',           label: 'Failed'           },
  { status: 'cancelled',        label: 'Cancelled'        },
];

const COLUMN_ACCENT: Record<string, string> = {
  queued:           'rgba(116,167,255,0.08)',
  running:          'rgba(56,200,114,0.08)',
  waiting_approval: 'rgba(255,152,0,0.08)',
  blocked:          'rgba(227,61,79,0.08)',
  completed:        'rgba(56,200,114,0.05)',
  failed:           'rgba(227,61,79,0.05)',
  cancelled:        'rgba(255,255,255,0.03)',
};

interface AiKanbanBoardProps {
  tasks: AiTaskRow[];
  onTaskClick: (taskId: bigint) => void;
  agentNames?: Map<bigint, string>;
}

function KanbanCard({ task, agentName, onClick }: { task: AiTaskRow; agentName?: string; onClick: () => void }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid rgba(255,255,255,0.07)',
        bgcolor: 'rgba(255,255,255,0.025)',
        borderRadius: '10px',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.14)' },
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 1.4 }}>
        <Stack spacing={0.8}>
          <Typography
            variant="body2"
            sx={{
              color: '#ffffff',
              fontWeight: 600,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {task.title}
          </Typography>
          {agentName && (
            <Typography variant="caption" sx={{ color: '#858585' }}>
              {agentName}
            </Typography>
          )}
          <Stack direction="row" spacing={0.8} alignItems="center">
            <AiPriorityIcon priority={task.priority} size={14} showTooltip />
            <Typography variant="caption" sx={{ color: '#555555', fontFamily: 'monospace', fontSize: '0.65rem' }}>
              #{task.id.toString().slice(-6)}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function KanbanColumn({ status, label, tasks, onTaskClick, agentNames }: {
  status: string;
  label: string;
  tasks: AiTaskRow[];
  onTaskClick: (id: bigint) => void;
  agentNames?: Map<bigint, string>;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 240,
        width: 240,
        flexShrink: 0,
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: COLUMN_ACCENT[status] ?? 'rgba(255,255,255,0.015)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 1.4,
          py: 1.1,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <AiStatusBadge status={status} />
        <Typography variant="caption" sx={{ color: '#858585', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#555555', fontWeight: 600, fontFamily: 'monospace' }}>
          {tasks.length}
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1, minHeight: 80 }}>
        <Stack spacing={0.8}>
          {tasks.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#444444', fontStyle: 'italic', display: 'block', textAlign: 'center', pt: 2 }}>
              Empty
            </Typography>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id.toString()}
                task={task}
                agentName={agentNames?.get(task.agentId)}
                onClick={() => onTaskClick(task.id)}
              />
            ))
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

export default function AiKanbanBoard({ tasks, onTaskClick, agentNames }: AiKanbanBoardProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, AiTaskRow[]>(BOARD_COLUMNS.map(c => [c.status, []]));
    for (const task of tasks) {
      const bucket = map.get(task.status) ?? map.get('queued')!;
      bucket.push(task);
    }
    return map;
  }, [tasks]);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        pb: 2,
        minHeight: 320,
        maxHeight: 640,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 3 },
      }}
    >
      {BOARD_COLUMNS.map(({ status, label }) => (
        <KanbanColumn
          key={status}
          status={status}
          label={label}
          tasks={grouped.get(status) ?? []}
          onTaskClick={onTaskClick}
          agentNames={agentNames}
        />
      ))}
    </Box>
  );
}
