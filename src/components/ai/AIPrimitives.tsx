import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { DashboardLayout } from '../layout/DashboardLayout';
import { chatColors } from '../../theme/chatColors';
import { darkTheme } from '../../theme/theme';
import { type AIPageKey } from './AIConfig';
import { AISidebar } from './AISidebar';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface AIWorkspacePageProps {
    page: AIPageKey;
    children: ReactNode;
    orgName?: string;
    onLogout?: () => void;
}

interface AIPageIntroProps {
    eyebrow?: string;
    title: string;
    description: string;
    supportingCopy?: string;
    actionSlot?: ReactNode;
}

interface AISectionCardProps {
    eyebrow?: string;
    title?: string;
    description?: string;
    actionSlot?: ReactNode;
    children: ReactNode;
    minHeight?: number | string;
}

interface AIStatCardProps {
    label: string;
    value: string;
    caption?: string;
    tone?: Tone;
}

interface AIStatusPillProps {
    label: string;
    tone?: Tone;
}

interface AIInfoRowProps {
    label: string;
    value: string;
    tone?: Tone;
}

interface AIProgressRowProps {
    label: string;
    value: number;
    detail?: string;
    tone?: Tone;
}

const toneMap: Record<Tone, { border: string; text: string; soft: string; bar: string }> = {
    neutral: {
        border: '#1a1a1a',
        text: '#858585',
        soft: 'rgba(255,255,255,0.03)',
        bar: '#7d7d7d',
    },
    info: {
        border: '#1a1a1a',
        text: '#7eb0ff',
        soft: 'rgba(255,255,255,0.03)',
        bar: '#7eb0ff',
    },
    success: {
        border: '#1a1a1a',
        text: '#38c872',
        soft: 'rgba(255,255,255,0.03)',
        bar: '#38c872',
    },
    warning: {
        border: '#1a1a1a',
        text: '#ff9800',
        soft: 'rgba(255,255,255,0.03)',
        bar: '#ff9800',
    },
    danger: {
        border: '#1a1a1a',
        text: '#e33d4f',
        soft: 'rgba(255,255,255,0.03)',
        bar: '#e33d4f',
    },
};

export function AIWorkspacePage({
    page,
    children,
    orgName,
    onLogout,
}: AIWorkspacePageProps) {
    return (
        <AIWorkspacePageInner page={page} orgName={orgName} onLogout={onLogout}>
            {children}
        </AIWorkspacePageInner>
    );
}

function AIWorkspacePageInner({
    page,
    children,
    orgName,
    onLogout,
}: AIWorkspacePageProps) {
    const {
        loading,
        effectiveOrgName,
        currentOrgId,
        membershipUnavailable,
        aiAgents,
        aiApprovals,
        aiRuns,
        aiWakeupRequests,
    } = useAIWorkspaceData();

    const resolvedOrgName = orgName ?? effectiveOrgName;

    return (
        <DashboardLayout
            orgName={resolvedOrgName}
            onLogout={onLogout}
            chatSidebar={
                <AISidebar
                    active={page}
                    signalCounts={{
                        activeAgents: aiAgents.filter((agent) => agent.status === 'active').length,
                        pendingApprovals: aiApprovals.filter((approval) => approval.status === 'pending').length,
                        liveWakeups: aiWakeupRequests.filter((wakeup) => ['queued', 'claimed', 'running'].includes(wakeup.status)).length,
                        failedRuns: aiRuns.filter((run) => run.status === 'failed').length,
                    }}
                />
            }
        >
            <ThemeProvider theme={darkTheme}>
            <Box sx={{ height: '100%', overflow: 'auto', bgcolor: chatColors.pageBg }}>
                <Box
                    sx={{
                        px: { xs: 2, md: 3 },
                        py: { xs: 2, md: 2.5 },
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}
                >
                    {loading ? (
                        <Box
                            sx={{
                                minHeight: '60vh',
                                display: 'grid',
                                placeItems: 'center',
                            }}
                        >
                            <CircularProgress size={30} sx={{ color: chatColors.textSecondary }} />
                        </Box>
                    ) : membershipUnavailable ? (
                        <AISectionCard
                            title="Workspace connection is not ready"
                            description="The AI workspace needs a live database connection before it can load org-scoped data."
                        >
                            <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                                Reconnect the workspace or refresh the page. Once the membership handshake completes,
                                the AI pages will load normally.
                            </Typography>
                        </AISectionCard>
                    ) : currentOrgId == null ? (
                        <AISectionCard
                            title="Join a workspace first"
                            description="AI controls are org-scoped. Create or join a workspace before using this area."
                        >
                            <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                                Once a workspace is available, the AI console will show your agents, tasks, approvals,
                                and activity here.
                            </Typography>
                        </AISectionCard>
                    ) : (
                        children
                    )}
                </Box>
            </Box>
            </ThemeProvider>
        </DashboardLayout>
    );
}

export function AIPageIntro({
    title,
    description,
    actionSlot,
}: AIPageIntroProps) {
    return (
        <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 0.5 }}
        >
            <Box>
                <Typography
                    variant="h6"
                    sx={{ color: '#ffffff', fontWeight: 700, letterSpacing: '-0.01em' }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: '#858585', mt: 0.4, lineHeight: 1.6 }}
                >
                    {description}
                </Typography>
            </Box>
            {actionSlot && <Box sx={{ flexShrink: 0 }}>{actionSlot}</Box>}
        </Stack>
    );
}

export function AISectionGrid({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1.5,
            }}
        >
            {children}
        </Box>
    );
}

export function AISectionCard({
    title,
    description,
    actionSlot,
    children,
    minHeight,
}: AISectionCardProps) {
    return (
        <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1, minHeight }}>
            {(title || actionSlot) && (
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1a1a1a' }}
                >
                    <Box>
                        {title && (
                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                {title}
                            </Typography>
                        )}
                        {description && (
                            <Typography variant="caption" sx={{ color: '#858585', display: 'block', mt: 0.2 }}>
                                {description}
                            </Typography>
                        )}
                    </Box>
                    {actionSlot && <Box>{actionSlot}</Box>}
                </Stack>
            )}
            <Box sx={{ p: 2 }}>{children}</Box>
        </Box>
    );
}

export function AIStatGrid({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1,
            }}
        >
            {children}
        </Box>
    );
}

export function AIStatCard({ label, value, caption, tone = 'neutral' }: AIStatCardProps) {
    return (
        <Box sx={{ p: 1.5, border: '1px solid #1a1a1a', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#858585', fontWeight: 600, display: 'block' }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, my: 0.25 }}>
                {value}
            </Typography>
            {caption && (
                <Typography variant="caption" sx={{ color: toneMap[tone].text }}>
                    {caption}
                </Typography>
            )}
        </Box>
    );
}

export function AIStatusPill({ label, tone = 'neutral' }: AIStatusPillProps) {
    const palette = toneMap[tone];

    return (
        <Chip
            size="small"
            label={label}
            sx={{
                borderRadius: '4px',
                border: `1px solid ${palette.border}`,
                bgcolor: palette.soft,
                color: palette.text,
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 20,
            }}
        />
    );
}

export function AIInfoRow({ label, value, tone = 'neutral' }: AIInfoRowProps) {
    return (
        <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            sx={{
                py: 1,
                borderBottom: `1px solid #1a1a1a`,
                '&:last-of-type': { borderBottom: 'none', pb: 0 },
                '&:first-of-type': { pt: 0 },
            }}
        >
            <Typography variant="body2" sx={{ color: '#858585' }}>
                {label}
            </Typography>
            <AIStatusPill label={value} tone={tone} />
        </Stack>
    );
}

export function AIProgressRow({ label, value, detail, tone = 'info' }: AIProgressRowProps) {
    const palette = toneMap[tone];

    return (
        <Stack spacing={0.75}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                    {label}
                </Typography>
                <Typography variant="caption" sx={{ color: '#858585', fontWeight: 600 }}>
                    {detail ?? `${value}%`}
                </Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={value}
                sx={{
                    height: 5,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        bgcolor: palette.bar,
                    },
                }}
            />
        </Stack>
    );
}
