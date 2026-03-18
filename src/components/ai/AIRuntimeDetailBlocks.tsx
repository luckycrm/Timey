import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import { AISectionCard, AIStatusPill } from './AIPrimitives';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface AIRuntimeSlot {
    label: string;
    value: string;
    tone?: Tone;
    helper?: string;
}

interface AIRuntimeAction {
    label: string;
    href: string;
    tone?: 'primary' | 'neutral' | 'danger';
}

interface AIRuntimeListItem {
    key: string;
    title: string;
    subtitle?: string;
    meta?: string;
    badges?: Array<{ label: string; tone?: Tone }>;
    actions?: AIRuntimeAction[];
}

interface AIRuntimeSlotsCardProps {
    eyebrow: string;
    title: string;
    description: string;
    slots: AIRuntimeSlot[];
    badges?: Array<{ label: string; tone?: Tone }>;
    footer?: string;
}

interface AIRuntimeListCardProps {
    eyebrow: string;
    title: string;
    description: string;
    items: AIRuntimeListItem[];
    emptyMessage: string;
}

function parseJsonRecord(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {};
    } catch {
        return {};
    }
}

export function humanizeRuntimeToken(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function readEnabledIntegrationLabels(value: string) {
    const parsed = parseJsonRecord(value);
    return Object.entries(parsed)
        .filter(([, rawValue]) => {
            if (typeof rawValue === 'boolean') return rawValue;
            if (typeof rawValue === 'string') return rawValue.trim().length > 0;
            if (typeof rawValue === 'number') return rawValue > 0;
            return rawValue != null;
        })
        .map(([key]) => humanizeRuntimeToken(key));
}

export function AIRuntimeSlotsCard({
    eyebrow,
    title,
    description,
    slots,
    badges,
    footer,
}: AIRuntimeSlotsCardProps) {
    return (
        <AISectionCard eyebrow={eyebrow} title={title} description={description}>
            {badges && badges.length > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {badges.map((badge) => (
                        <AIStatusPill key={`${badge.label}-${badge.tone || 'neutral'}`} label={badge.label} tone={badge.tone || 'neutral'} />
                    ))}
                </Stack>
            ) : null}
            <Stack spacing={1.1}>
                {slots.map((slot) => (
                    <Box
                        key={slot.label}
                        sx={{
                            px: 1.4,
                            py: 1.2,
                            borderRadius: appRadii.card,
                            border: `1px solid ${chatColors.border}`,
                            bgcolor: 'rgba(255,255,255,0.015)',
                        }}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: chatColors.textSecondary }}>
                                {slot.label}
                            </Typography>
                            <AIStatusPill label={slot.value} tone={slot.tone || 'neutral'} />
                        </Stack>
                        {slot.helper ? (
                            <Typography variant="caption" sx={{ color: chatColors.textMuted, lineHeight: 1.55, display: 'block', mt: 0.85 }}>
                                {slot.helper}
                            </Typography>
                        ) : null}
                    </Box>
                ))}
            </Stack>
            {footer ? (
                <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.65 }}>
                    {footer}
                </Typography>
            ) : null}
        </AISectionCard>
    );
}

export function AIRuntimeListCard({
    eyebrow,
    title,
    description,
    items,
    emptyMessage,
}: AIRuntimeListCardProps) {
    return (
        <AISectionCard eyebrow={eyebrow} title={title} description={description}>
            <Stack spacing={1.2}>
                {items.length === 0 ? (
                    <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                        {emptyMessage}
                    </Typography>
                ) : items.map((item) => (
                    <Box
                        key={item.key}
                        sx={{
                            px: 1.6,
                            py: 1.45,
                            borderRadius: appRadii.card,
                            border: `1px solid ${chatColors.border}`,
                            bgcolor: 'rgba(255,255,255,0.015)',
                        }}
                    >
                        <Stack spacing={1}>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', md: 'flex-start' }}
                            >
                                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {item.title}
                                    </Typography>
                                    {item.subtitle ? (
                                        <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
                                            {item.subtitle}
                                        </Typography>
                                    ) : null}
                                </Stack>
                                {item.badges && item.badges.length > 0 ? (
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ md: 'flex-end' }}>
                                        {item.badges.map((badge) => (
                                            <AIStatusPill key={`${item.key}-${badge.label}`} label={badge.label} tone={badge.tone || 'neutral'} />
                                        ))}
                                    </Stack>
                                ) : null}
                            </Stack>
                            {item.meta ? (
                                <Typography variant="body2" sx={{ color: chatColors.textMuted, lineHeight: 1.65 }}>
                                    {item.meta}
                                </Typography>
                            ) : null}
                            {item.actions && item.actions.length > 0 ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {item.actions.map((action) => (
                                        <Button
                                            key={`${item.key}-${action.label}`}
                                            size="small"
                                            variant={action.tone === 'primary' ? 'contained' : 'outlined'}
                                            color={action.tone === 'danger' ? 'error' : 'primary'}
                                            href={action.href}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </Stack>
                            ) : null}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </AISectionCard>
    );
}
