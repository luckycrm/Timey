import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { DashboardLayout } from '../layout/DashboardLayout';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
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
    eyebrow: string;
    title: string;
    description: string;
    supportingCopy?: string;
    actionSlot?: ReactNode;
}

interface AISectionCardProps {
    eyebrow?: string;
    title: string;
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
        border: 'rgba(255,255,255,0.12)',
        text: '#d5d5d5',
        soft: 'rgba(255,255,255,0.05)',
        bar: '#7d7d7d',
    },
    info: {
        border: 'rgba(116,167,255,0.35)',
        text: '#b9d1ff',
        soft: 'rgba(116,167,255,0.12)',
        bar: '#7eb0ff',
    },
    success: {
        border: 'rgba(56,200,114,0.34)',
        text: '#9de0b6',
        soft: 'rgba(56,200,114,0.12)',
        bar: '#38c872',
    },
    warning: {
        border: 'rgba(255,152,0,0.34)',
        text: '#ffc47b',
        soft: 'rgba(255,152,0,0.12)',
        bar: '#ff9800',
    },
    danger: {
        border: 'rgba(227,61,79,0.34)',
        text: '#f5a3ad',
        soft: 'rgba(227,61,79,0.12)',
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
            <Box sx={{ height: '100%', overflow: 'auto', bgcolor: chatColors.pageBg }}>
                <Box
                    sx={{
                        px: { xs: 2, md: 3 },
                        py: { xs: 2, md: 3 },
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5,
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
                            eyebrow="Connection"
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
                            eyebrow="Workspace"
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
        </DashboardLayout>
    );
}

export function AIPageIntro({
    eyebrow,
    title,
    description,
    supportingCopy,
    actionSlot,
}: AIPageIntroProps) {
    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2.25, md: 2.75 },
                borderRadius: appRadii.panel,
                border: `1px solid ${chatColors.border}`,
                bgcolor: chatColors.panelBg,
                backgroundImage: 'linear-gradient(135deg, rgba(126,176,255,0.12), transparent 40%)',
            }}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                justifyContent="space-between"
            >
                <Box sx={{ maxWidth: 760 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: '#7eb0ff',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                        }}
                    >
                        {eyebrow}
                    </Typography>
                    <Typography
                        variant="h4"
                        sx={{
                            color: chatColors.textPrimary,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            mt: 0.8,
                            mb: 1,
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                        {description}
                    </Typography>
                    {supportingCopy ? (
                        <Typography variant="body2" sx={{ color: chatColors.textMuted, lineHeight: 1.7, mt: 1.2 }}>
                            {supportingCopy}
                        </Typography>
                    ) : null}
                </Box>
                {actionSlot ? <Box sx={{ alignSelf: { xs: 'stretch', md: 'flex-end' } }}>{actionSlot}</Box> : null}
            </Stack>
        </Paper>
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
                gap: 2,
            }}
        >
            {children}
        </Box>
    );
}

export function AISectionCard({
    eyebrow,
    title,
    description,
    actionSlot,
    children,
    minHeight,
}: AISectionCardProps) {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 2.25,
                borderRadius: appRadii.panel,
                border: `1px solid ${chatColors.border}`,
                bgcolor: 'rgba(255,255,255,0.02)',
                minHeight,
            }}
        >
            <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                        {eyebrow ? (
                            <Typography
                                variant="caption"
                                sx={{
                                    color: chatColors.textMuted,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                {eyebrow}
                            </Typography>
                        ) : null}
                        <Typography variant="h6" sx={{ color: chatColors.textPrimary, fontWeight: 650, mt: eyebrow ? 0.5 : 0 }}>
                            {title}
                        </Typography>
                        {description ? (
                            <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.65, mt: 0.6 }}>
                                {description}
                            </Typography>
                        ) : null}
                    </Box>
                    {actionSlot ? <Box sx={{ flexShrink: 0 }}>{actionSlot}</Box> : null}
                </Stack>
                {children}
            </Stack>
        </Paper>
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
                gap: 1.5,
            }}
        >
            {children}
        </Box>
    );
}

export function AIStatCard({ label, value, caption, tone = 'neutral' }: AIStatCardProps) {
    const palette = toneMap[tone];

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                borderRadius: appRadii.card,
                border: `1px solid ${palette.border}`,
                bgcolor: palette.soft,
            }}
        >
            <Stack spacing={0.8}>
                <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontWeight: 600 }}>
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ color: chatColors.textPrimary, fontWeight: 700 }}>
                    {value}
                </Typography>
                {caption ? (
                    <Typography variant="body2" sx={{ color: palette.text, lineHeight: 1.5 }}>
                        {caption}
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}

export function AIStatusPill({ label, tone = 'neutral' }: AIStatusPillProps) {
    const palette = toneMap[tone];

    return (
        <Chip
            size="small"
            label={label}
            sx={{
                borderRadius: appRadii.badge,
                border: `1px solid ${palette.border}`,
                bgcolor: palette.soft,
                color: palette.text,
                fontWeight: 600,
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
                py: 1.1,
                borderBottom: `1px solid ${chatColors.border}`,
                '&:last-of-type': { borderBottom: 'none', pb: 0 },
                '&:first-of-type': { pt: 0 },
            }}
        >
            <Typography variant="body2" sx={{ color: chatColors.textSecondary }}>
                {label}
            </Typography>
            <AIStatusPill label={value} tone={tone} />
        </Stack>
    );
}

export function AIProgressRow({ label, value, detail, tone = 'info' }: AIProgressRowProps) {
    const palette = toneMap[tone];

    return (
        <Stack spacing={0.9}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                <Typography variant="body2" sx={{ color: chatColors.textPrimary, fontWeight: 500 }}>
                    {label}
                </Typography>
                <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontWeight: 600 }}>
                    {detail ?? `${value}%`}
                </Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={value}
                sx={{
                    height: 7,
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
