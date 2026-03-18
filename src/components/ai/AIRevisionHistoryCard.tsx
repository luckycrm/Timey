import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { AiConfigRevision, User } from '../../module_bindings/types';
import { chatColors } from '../../theme/chatColors';
import { appRadii } from '../../theme/radii';
import { AISectionCard, AIStatusPill } from './AIPrimitives';
import { formatBigIntDateTime, formatRelativeTime } from './aiUtils';
import { humanizeRuntimeToken } from './AIRuntimeDetailBlocks';

interface RevisionBadge {
    label: string;
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

interface AIRevisionHistoryCardProps {
    eyebrow: string;
    title: string;
    description: string;
    revisions: AiConfigRevision[];
    emptyMessage: string;
    usersById?: Map<bigint, User>;
    summarizeRevision?: (revision: AiConfigRevision) => string;
    badgesForRevision?: (revision: AiConfigRevision) => RevisionBadge[];
    restoringRevisionId?: bigint | null;
    canRestore?: boolean;
    onRestore?: (revisionId: bigint) => void | Promise<void>;
}

function parseMetadata(value: string): Record<string, string> {
    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .filter(([, entry]) => entry != null && String(entry).trim().length > 0)
                .map(([key, entry]) => [key, String(entry)])
        );
    } catch {
        return {};
    }
}

function defaultSummarizeRevision(revision: AiConfigRevision, usersById?: Map<bigint, User>) {
    const actor = usersById?.get(revision.actorUserId);
    const actorLabel = actor?.name || actor?.email;
    const metadata = parseMetadata(revision.metadataJson);
    const restoredFrom = metadata.restored_from_revision_id
        ? ` Restored from revision ${metadata.restored_from_revision_id}.`
        : '';
    return `${actorLabel ? `${actorLabel} saved this ${humanizeRuntimeToken(revision.scopeType)} snapshot.` : `Saved ${humanizeRuntimeToken(revision.scopeType)} snapshot.`}${restoredFrom}`.trim();
}

function defaultBadgesForRevision(revision: AiConfigRevision): RevisionBadge[] {
    const metadata = parseMetadata(revision.metadataJson);
    const badges: RevisionBadge[] = [
        { label: humanizeRuntimeToken(revision.scopeType), tone: revision.scopeType === 'agent_runtime' ? 'info' : 'neutral' },
    ];
    if (metadata.adapter_type) {
        badges.push({ label: humanizeRuntimeToken(metadata.adapter_type), tone: 'info' });
    }
    if (metadata.runtime_status) {
        badges.push({
            label: humanizeRuntimeToken(metadata.runtime_status),
            tone: metadata.runtime_status === 'ready' ? 'success' : metadata.runtime_status === 'error' ? 'danger' : 'neutral',
        });
    }
    if (metadata.default_model) {
        badges.push({ label: metadata.default_model, tone: 'neutral' });
    }
    if (metadata.autonomy_posture) {
        badges.push({ label: humanizeRuntimeToken(metadata.autonomy_posture), tone: 'warning' });
    }
    if (metadata.restored_from_revision_id) {
        badges.push({ label: `Restored`, tone: 'success' });
    }
    return badges.slice(0, 4);
}

export function AIRevisionHistoryCard({
    eyebrow,
    title,
    description,
    revisions,
    emptyMessage,
    usersById,
    summarizeRevision,
    badgesForRevision,
    restoringRevisionId = null,
    canRestore = false,
    onRestore,
}: AIRevisionHistoryCardProps) {
    return (
        <AISectionCard eyebrow={eyebrow} title={title} description={description}>
            <Stack spacing={1.2}>
                {revisions.length === 0 ? (
                    <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                        {emptyMessage}
                    </Typography>
                ) : revisions.map((revision) => (
                    <Stack
                        key={revision.id.toString()}
                        spacing={0.95}
                        sx={{
                            px: 1.5,
                            py: 1.35,
                            borderRadius: appRadii.card,
                            border: `1px solid ${chatColors.border}`,
                            bgcolor: 'rgba(255,255,255,0.015)',
                        }}
                    >
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', md: 'center' }}
                            justifyContent="space-between"
                        >
                            <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                    {revision.revisionLabel}
                                </Typography>
                                <Typography variant="caption" sx={{ color: chatColors.textMuted }}>
                                    Saved {formatBigIntDateTime(revision.createdAt)} • {formatRelativeTime(revision.createdAt)}
                                </Typography>
                            </Stack>
                            {canRestore && onRestore ? (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{ textTransform: 'none' }}
                                    disabled={restoringRevisionId === revision.id}
                                    onClick={() => void onRestore(revision.id)}
                                >
                                    {restoringRevisionId === revision.id ? 'Restoring...' : 'Restore'}
                                </Button>
                            ) : null}
                        </Stack>

                        <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.7 }}>
                            {(summarizeRevision ?? ((row) => defaultSummarizeRevision(row, usersById)))(revision)}
                        </Typography>

                        {(badgesForRevision || usersById) ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {((badgesForRevision ?? defaultBadgesForRevision)(revision) || []).map((badge) => (
                                    <AIStatusPill
                                        key={`${revision.id.toString()}-${badge.label}`}
                                        label={badge.label}
                                        tone={badge.tone || 'neutral'}
                                    />
                                ))}
                            </Stack>
                        ) : null}
                    </Stack>
                ))}
            </Stack>
        </AISectionCard>
    );
}
