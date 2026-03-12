import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import { aiPageDefinitions, type AIPageKey } from './AIConfig';

interface AISidebarProps {
    active: AIPageKey;
    signalCounts?: {
        activeAgents: number;
        pendingApprovals: number;
        liveWakeups?: number;
        failedRuns?: number;
    };
}

export function AISidebar({ active, signalCounts }: AISidebarProps) {
    const pageRoutes: Record<AIPageKey, string> = {
        home: '/ai',
        agents: '/ai/agents',
        tasks: '/ai/tasks',
        board: '/ai/board',
        approvals: '/ai/approvals',
        inbox: '/ai/inbox',
        activity: '/ai/activity',
        projects: '/ai/projects',
        goals: '/ai/goals',
        costs: '/ai/costs',
        org: '/ai/org',
        settings: '/ai/settings',
        secrets: '/ai/secrets',
        llms: '/ai/llms',
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
            <Box
                sx={{
                    border: `1px solid ${chatColors.border}`,
                    borderRadius: appRadii.panel,
                    bgcolor: chatColors.panelBg,
                    px: 2,
                    py: 2,
                    backgroundImage: 'linear-gradient(180deg, rgba(116,167,255,0.12), transparent 46%)',
                }}
            >
                <Stack spacing={1.1}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: '#7eb0ff',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                        }}
                    >
                        AI Workspace
                    </Typography>
                    <Typography variant="subtitle1" sx={{ color: chatColors.textPrimary, fontWeight: 700 }}>
                        Operator console
                    </Typography>
                    <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.6 }}>
                        One control surface for agent staffing, execution, approvals, inbox review, and workspace policy.
                    </Typography>
                </Stack>
            </Box>

            <Stack spacing={0.75} sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {aiPageDefinitions.map((page) => {
                    const Icon = page.icon;
                    const isActive = page.key === active;

                    return (
                        <Link
                            key={page.key}
                            to={pageRoutes[page.key]}
                            style={{ textDecoration: 'none', display: 'block' }}
                        >
                            <Box
                                sx={{
                                    px: 1.5,
                                    py: 1.25,
                                    borderRadius: appRadii.control,
                                    border: `1px solid ${isActive ? 'rgba(126,176,255,0.35)' : chatColors.border}`,
                                    bgcolor: isActive ? 'rgba(126,176,255,0.08)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        borderColor: isActive ? 'rgba(126,176,255,0.42)' : 'rgba(255,255,255,0.16)',
                                        bgcolor: isActive ? 'rgba(126,176,255,0.1)' : 'rgba(255,255,255,0.025)',
                                    },
                                }}
                            >
                                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                    <Box
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: appRadii.control,
                                            display: 'grid',
                                            placeItems: 'center',
                                            bgcolor: isActive ? 'rgba(126,176,255,0.18)' : 'rgba(255,255,255,0.04)',
                                            color: isActive ? '#dbe8ff' : chatColors.textSecondary,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ color: chatColors.textPrimary, fontWeight: 600 }}>
                                            {page.label}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: isActive ? '#b9d1ff' : chatColors.textMuted,
                                                lineHeight: 1.45,
                                                display: 'block',
                                                mt: 0.35,
                                            }}
                                        >
                                            {page.description}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        </Link>
                    );
                })}
            </Stack>

            <Box
                sx={{
                    flexShrink: 0,
                    border: `1px solid ${chatColors.border}`,
                    borderRadius: appRadii.panel,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    px: 2,
                    py: 2,
                }}
            >
                <Stack spacing={1.25}>
                    <Typography variant="caption" sx={{ color: chatColors.textMuted, fontWeight: 700 }}>
                        Live signals
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                            size="small"
                            label={`${signalCounts?.activeAgents ?? 0} active agents`}
                            sx={{
                                bgcolor: 'rgba(56,200,114,0.12)',
                                color: '#9de0b6',
                                borderRadius: appRadii.badge,
                            }}
                        />
                        <Chip
                            size="small"
                            label={`${signalCounts?.pendingApprovals ?? 0} approvals pending`}
                            sx={{
                                bgcolor: 'rgba(255,152,0,0.12)',
                                color: '#ffc47b',
                                borderRadius: appRadii.badge,
                            }}
                        />
                        <Chip
                            size="small"
                            label={`${signalCounts?.liveWakeups ?? 0} live wakeups`}
                            sx={{
                                bgcolor: 'rgba(116,167,255,0.12)',
                                color: '#b9d1ff',
                                borderRadius: appRadii.badge,
                            }}
                        />
                        <Chip
                            size="small"
                            label={`${signalCounts?.failedRuns ?? 0} failed runs`}
                            sx={{
                                bgcolor: 'rgba(227,61,79,0.12)',
                                color: '#f5a3ad',
                                borderRadius: appRadii.badge,
                            }}
                        />
                    </Stack>
                    <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.6 }}>
                        These counts are live workspace signals from the current AI control-plane records.
                    </Typography>
                </Stack>
            </Box>
        </Box>
    );
}
