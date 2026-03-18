// Port of StatusBadge/StatusIcon from paperclip, adapted to use MUI Chip.

import Chip from '@mui/material/Chip';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const statusToneMap: Record<string, Tone> = {
  queued: 'neutral',
  running: 'info',
  waiting_approval: 'warning',
  blocked: 'danger',
  failed: 'danger',
  completed: 'success',
  cancelled: 'neutral',
  claimed: 'info',
};

const toneColors: Record<Tone, { border: string; text: string; bg: string }> = {
  neutral: { border: 'rgba(255,255,255,0.12)', text: '#d5d5d5', bg: 'rgba(255,255,255,0.05)' },
  info:    { border: 'rgba(116,167,255,0.35)', text: '#b9d1ff', bg: 'rgba(116,167,255,0.12)' },
  success: { border: 'rgba(56,200,114,0.34)',  text: '#9de0b6', bg: 'rgba(56,200,114,0.12)'  },
  warning: { border: 'rgba(255,152,0,0.34)',   text: '#ffc47b', bg: 'rgba(255,152,0,0.12)'   },
  danger:  { border: 'rgba(227,61,79,0.34)',   text: '#f5a3ad', bg: 'rgba(227,61,79,0.12)'   },
};

interface AiStatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
}

export default function AiStatusBadge({ status, size = 'small' }: AiStatusBadgeProps) {
  const tone: Tone = statusToneMap[status] ?? 'neutral';
  const colors = toneColors[tone];
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Chip
      size={size}
      label={label}
      sx={{
        borderRadius: '6px',
        border: `1px solid ${colors.border}`,
        bgcolor: colors.bg,
        color: colors.text,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
      }}
    />
  );
}
