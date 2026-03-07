import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';

export const meetingsRadius = appRadii;

export const meetingsPanelSx: SxProps<Theme> = {
    p: { xs: 1.6, md: 2 },
    bgcolor: chatColors.panelBg,
    border: `1px solid ${alpha(chatColors.textPrimary, 0.07)}`,
    borderRadius: meetingsRadius.panel,
    boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
    backdropFilter: 'blur(18px)',
};

export const meetingsInputSx: SxProps<Theme> = {
    '& .MuiInputBase-root': {
        color: chatColors.textPrimary,
        bgcolor: alpha(chatColors.textPrimary, 0.04),
        borderRadius: meetingsRadius.control,
    },
    '& .MuiInputBase-input': {
        color: chatColors.textPrimary,
    },
    '& .MuiInputBase-input::placeholder': {
        color: chatColors.textMuted,
        opacity: 1,
    },
    '& .MuiInputLabel-root': { color: chatColors.textSecondary },
    '& .MuiInputLabel-root.Mui-focused': { color: chatColors.textPrimary },
    '& .MuiInputLabel-root.MuiInputLabel-shrink': { color: chatColors.textSecondary },
    '& .MuiSelect-icon': { color: chatColors.textSecondary },
    '& .Mui-disabled': {
        color: chatColors.textMuted,
        WebkitTextFillColor: chatColors.textMuted,
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(chatColors.textPrimary, 0.12) },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(chatColors.textPrimary, 0.22),
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(chatColors.actionBg, 0.6),
    },
    '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
        filter: 'invert(1)',
        opacity: 0.75,
        cursor: 'pointer',
    },
};

export const meetingsPrimaryButtonSx: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 700,
    minHeight: 36,
    borderRadius: meetingsRadius.control,
    bgcolor: chatColors.actionBg,
    color: chatColors.actionText,
    border: `1px solid ${alpha(chatColors.actionText, 0.08)}`,
    '&:hover': { bgcolor: chatColors.actionBgHover },
    '&.Mui-disabled': {
        bgcolor: '#333333',
        color: chatColors.textMuted,
    },
};

export const meetingsSecondaryButtonSx: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 700,
    minHeight: 36,
    borderRadius: meetingsRadius.control,
    color: chatColors.textPrimary,
    border: `1px solid ${alpha(chatColors.textPrimary, 0.11)}`,
    bgcolor: chatColors.inputBg,
    '&:hover': {
        bgcolor: alpha(chatColors.textPrimary, 0.06),
    },
};

type MeetingsStatTone = 'default' | 'accent' | 'success';

interface MeetingsStat {
    label: string;
    value: string | number;
    helper?: string;
    tone?: MeetingsStatTone;
}

interface MeetingsPageShellProps {
    icon?: ReactNode;
    title?: string;
    description?: string;
    actions?: ReactNode;
    stats?: MeetingsStat[];
    hideHeader?: boolean;
    children: ReactNode;
}

interface MeetingsPanelProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    sx?: SxProps<Theme>;
}

function statToneStyles(tone: MeetingsStatTone | undefined) {
    if (tone === 'success') {
        return {
            valueColor: chatColors.success,
            borderColor: alpha(chatColors.success, 0.18),
            bg: alpha(chatColors.success, 0.08),
            accent: alpha(chatColors.success, 0.9),
        };
    }
    if (tone === 'accent') {
        return {
            valueColor: chatColors.textPrimary,
            borderColor: alpha(chatColors.textPrimary, 0.2),
            bg: alpha(chatColors.textPrimary, 0.06),
            accent: alpha(chatColors.textPrimary, 0.92),
        };
    }
    return {
        valueColor: chatColors.textPrimary,
        borderColor: alpha(chatColors.textPrimary, 0.08),
        bg: chatColors.panelAltBg,
        accent: alpha(chatColors.textSecondary, 0.6),
    };
}

export function MeetingsPageShell({
    icon,
    title = '',
    description = '',
    actions,
    stats = [],
    hideHeader = false,
    children,
}: MeetingsPageShellProps) {
    return (
        <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: chatColors.pageBg }}>
            <Stack spacing={2.2}>
                {!hideHeader ? (
                    <Paper
                        sx={{
                            ...meetingsPanelSx,
                            p: { xs: 1.5, md: 1.8 },
                            bgcolor: chatColors.panelBg,
                            overflow: 'hidden',
                        }}
                    >
                        <Stack spacing={1.35}>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={1.5}
                                alignItems={{ xs: 'stretch', md: 'flex-start' }}
                                justifyContent="space-between"
                            >
                                <Stack spacing={0.95} sx={{ minWidth: 0, flex: 1 }}>
                                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <Box
                                            sx={{
                                                px: 1,
                                                minHeight: 24,
                                                borderRadius: meetingsRadius.badge,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: chatColors.textPrimary,
                                                bgcolor: alpha(chatColors.textPrimary, 0.05),
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.12)}`,
                                                fontSize: '0.66rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.08em',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Meetings
                                        </Box>
                                        <Typography sx={{ color: chatColors.textMuted, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.02em' }}>
                                            Workspace control surface
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1.2} alignItems="flex-start">
                                        <Box
                                            sx={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: meetingsRadius.card,
                                                flexShrink: 0,
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: chatColors.textPrimary,
                                                bgcolor: chatColors.panelAltBg,
                                                border: `1px solid ${alpha(chatColors.textPrimary, 0.12)}`,
                                            }}
                                        >
                                            {icon}
                                        </Box>
                                        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                                            <Typography sx={{ color: chatColors.textPrimary, fontSize: { xs: '1.02rem', md: '1.14rem' }, fontWeight: 800, lineHeight: 1.15 }}>
                                                {title}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    color: chatColors.textSecondary,
                                                    fontSize: '0.78rem',
                                                    lineHeight: 1.55,
                                                    maxWidth: 780,
                                                }}
                                            >
                                                {description}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </Stack>
                                {actions ? (
                                    <Stack
                                        direction="row"
                                        spacing={0.8}
                                        flexWrap="wrap"
                                        useFlexGap
                                        sx={{
                                            alignSelf: { xs: 'stretch', md: 'center' },
                                            justifyContent: { xs: 'flex-start', md: 'flex-end' },
                                            minWidth: { md: 260 },
                                        }}
                                    >
                                        {actions}
                                    </Stack>
                                ) : null}
                            </Stack>

                            {stats.length > 0 ? (
                                <Box
                                    sx={{
                                        pt: 1.15,
                                        borderTop: `1px solid ${alpha(chatColors.textPrimary, 0.07)}`,
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: 'repeat(2, minmax(0, 1fr))',
                                            lg: `repeat(${Math.min(Math.max(stats.length, 2), 4)}, minmax(0, 1fr))`,
                                        },
                                        gap: 0.95,
                                    }}
                                >
                                    {stats.map((stat) => {
                                        const tone = statToneStyles(stat.tone);
                                        return (
                                            <Box
                                                key={stat.label}
                                                sx={{
                                                    p: 1.05,
                                                    borderRadius: meetingsRadius.card,
                                                    border: `1px solid ${tone.borderColor}`,
                                                    bgcolor: tone.bg,
                                                    minHeight: 76,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: 2,
                                                        bgcolor: tone.accent,
                                                    }}
                                                />
                                                <Stack spacing={0.35}>
                                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                        <Typography
                                                            sx={{
                                                                color: chatColors.textMuted,
                                                                fontSize: '0.63rem',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.08em',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {stat.label}
                                                        </Typography>
                                                        <Box
                                                            sx={{
                                                                width: 7,
                                                                height: 7,
                                                                borderRadius: meetingsRadius.full,
                                                                bgcolor: tone.accent,
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    </Stack>
                                                    <Typography sx={{ color: tone.valueColor, fontSize: '1.02rem', fontWeight: 800, lineHeight: 1.15 }}>
                                                        {stat.value}
                                                    </Typography>
                                                    {stat.helper ? (
                                                        <Typography sx={{ color: chatColors.textSecondary, fontSize: '0.67rem', lineHeight: 1.45 }}>
                                                            {stat.helper}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ) : null}
                        </Stack>
                    </Paper>
                ) : null}

                {children}
            </Stack>
        </Box>
    );
}

export function MeetingsPanel({
    title,
    description,
    icon,
    action,
    children,
    sx,
}: MeetingsPanelProps) {
    return (
        <Paper sx={{ ...meetingsPanelSx, ...sx }}>
            <Stack spacing={1.35}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                >
                    <Stack spacing={0.45}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                            {icon ? (
                                <Box sx={{ color: '#cad2df', display: 'grid', placeItems: 'center' }}>
                                    {icon}
                                </Box>
                            ) : null}
                            <Typography sx={{ color: chatColors.textPrimary, fontSize: '0.92rem', fontWeight: 700 }}>
                                {title}
                            </Typography>
                        </Stack>
                        {description ? (
                            <Typography sx={{ color: '#7f8897', fontSize: '0.72rem' }}>
                                {description}
                            </Typography>
                        ) : null}
                    </Stack>
                    {action}
                </Stack>
                {children}
            </Stack>
        </Paper>
    );
}
