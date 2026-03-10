// Port of PriorityIcon from paperclip, adapted to use MUI icons and MUI styling.

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RemoveIcon from '@mui/icons-material/Remove';
import ErrorIcon from '@mui/icons-material/Error';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

export type AiPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none' | 'normal';

interface PriorityConfig {
  icon: React.ElementType;
  color: string;
  label: string;
}

const priorityConfig: Record<string, PriorityConfig> = {
  urgent: { icon: ErrorIcon, color: '#e33d4f', label: 'Urgent' },
  high: { icon: KeyboardArrowUpIcon, color: '#ff9800', label: 'High' },
  medium: { icon: RemoveIcon, color: '#ffc107', label: 'Medium' },
  normal: { icon: RemoveIcon, color: '#ffc107', label: 'Normal' },
  low: { icon: KeyboardArrowDownIcon, color: '#7eb0ff', label: 'Low' },
  none: { icon: RemoveIcon, color: '#666666', label: 'None' },
};

interface AiPriorityIconProps {
  priority: string;
  size?: number;
  showTooltip?: boolean;
}

export default function AiPriorityIcon({ priority, size = 16, showTooltip = true }: AiPriorityIconProps) {
  const config = priorityConfig[priority] ?? priorityConfig.none!;
  const Icon = config.icon;

  const icon = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: config.color,
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: size }} />
    </Box>
  );

  if (showTooltip) {
    return (
      <Tooltip title={config.label} placement="top">
        {icon}
      </Tooltip>
    );
  }

  return icon;
}
