import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { AIRevisionHistoryCard } from './AIRevisionHistoryCard';
import { formatBigIntDateTime, parseJsonList } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const autonomyOptions = [
    { value: 'manual', label: 'Manual only', description: 'Agents wait for a person before taking important actions.' },
    { value: 'guarded', label: 'Guarded autonomy', description: 'Agents can work ahead, but sensitive actions stop for review.' },
    { value: 'autonomous', label: 'High autonomy', description: 'Agents are allowed to execute more steps without approval.' },
] as const;

const fallbackOptions = [
    { value: 'human-first', label: 'Hand off to a person', description: 'Escalate to a teammate as soon as something looks wrong.' },
    { value: 'queue-only', label: 'Queue for later', description: 'Leave the work in queue until someone reviews it.' },
    { value: 'retry-then-human', label: 'Retry, then hand off', description: 'Try one more automated pass before escalating.' },
] as const;

const policyOptions = [
    { value: 'manual_approval', label: 'Always ask first', description: 'Nothing sent without approval.' },
    { value: 'owner_review', label: 'Owner review', description: 'Send to an owner before execution.' },
    { value: 'auto_allowed', label: 'Allow automatically', description: 'Can run without waiting for a person.' },
] as const;

function findLabel(options: readonly { value: string; label: string }[], value: string) {
    return options.find((o) => o.value === value)?.label || value;
}

function summarizeWorkspaceRevision(revision: { payloadJson: string }) {
    try {
        const parsed = JSON.parse(revision.payloadJson) as Record<string, unknown>;
        return [
            typeof parsed.default_model === 'string' ? parsed.default_model : null,
            typeof parsed.autonomy_posture === 'string' ? findLabel(autonomyOptions, parsed.autonomy_posture) : null,
        ].filter(Boolean).join(' • ') || 'Saved settings snapshot';
    } catch {
        return 'Saved settings snapshot';
    }
}

function badgesForWorkspaceRevision(revision: { metadataJson: string }) {
    try {
        const meta = JSON.parse(revision.metadataJson) as Record<string, unknown>;
        const badges: Array<{ label: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = [];
        if (typeof meta.default_model === 'string') badges.push({ label: meta.default_model, tone: 'neutral' });
        if (typeof meta.autonomy_posture === 'string') badges.push({ label: findLabel(autonomyOptions, meta.autonomy_posture), tone: 'warning' });
        if (typeof meta.restored_from_revision_id === 'string') badges.push({ label: `Restored from ${meta.restored_from_revision_id}`, tone: 'success' });
        return badges;
    } catch {
        return [];
    }
}

export function AISettingsPage() {
    const { currentOrgId, isOwner, aiActivities, aiConfigRevisions, aiSettings } = useAIWorkspaceData();

    const upsertAiWorkspaceSettings = useReducer(reducers.upsertAiWorkspaceSettings);
    const restoreAiWorkspaceSettingsRevision = useReducer(reducers.restoreAiWorkspaceSettingsRevision);

    const [form, setForm] = useState({
        defaultModel: 'gpt-5-class',
        autonomyPosture: 'guarded',
        fallbackMode: 'human-first',
        externalSendPolicy: 'manual_approval',
        budgetChangePolicy: 'owner_review',
        internalNotesPolicy: 'auto_allowed',
        auditRetentionDays: '90',
        maxRunCostUsd: '25',
        integrations: 'calendar,docs,email,crm',
    });

    useEffect(() => {
        if (!aiSettings) return;
        setForm({
            defaultModel: aiSettings.defaultModel,
            autonomyPosture: aiSettings.autonomyPosture,
            fallbackMode: aiSettings.fallbackMode,
            externalSendPolicy: aiSettings.externalSendPolicy,
            budgetChangePolicy: aiSettings.budgetChangePolicy,
            internalNotesPolicy: aiSettings.internalNotesPolicy,
            auditRetentionDays: aiSettings.auditRetentionDays.toString(),
            maxRunCostUsd: (Number(aiSettings.maxRunCostMicrousd) / 1_000_000).toString(),
            integrations: parseJsonList(aiSettings.integrationsJson).join(','),
        });
    }, [aiSettings]);

    const [restoringRevisionId, setRestoringRevisionId] = useState<bigint | null>(null);

    const savedIntegrations = useMemo(
        () => parseJsonList(aiSettings?.integrationsJson || JSON.stringify(form.integrations.split(',').map((s) => s.trim()).filter(Boolean))),
        [aiSettings?.integrationsJson, form.integrations]
    );

    const recentChanges = [...aiActivities]
        .filter((e) => e.eventType === 'workspace_settings_updated')
        .sort((a, b) => Number(b.createdAt - a.createdAt))
        .slice(0, 5);

    const settingsRevisions = [...aiConfigRevisions]
        .filter((r) => r.scopeType === 'workspace_settings' && r.scopeId === currentOrgId)
        .sort((a, b) => Number(b.createdAt - a.createdAt))
        .slice(0, 8);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (currentOrgId == null) return;
        try {
            await upsertAiWorkspaceSettings({
                orgId: currentOrgId,
                defaultModel: form.defaultModel,
                autonomyPosture: form.autonomyPosture,
                fallbackMode: form.fallbackMode,
                externalSendPolicy: form.externalSendPolicy,
                budgetChangePolicy: form.budgetChangePolicy,
                internalNotesPolicy: form.internalNotesPolicy,
                integrationsJson: JSON.stringify(form.integrations.split(',').map((s) => s.trim()).filter(Boolean)),
                auditRetentionDays: BigInt(Math.max(1, Number(form.auditRetentionDays || '0'))),
                maxRunCostMicrousd: BigInt(Math.max(0, Math.round(Number(form.maxRunCostUsd || '0') * 1_000_000))),
            });
            toast.success('AI settings saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save AI settings');
        }
    };

    const handleRestoreRevision = async (revisionId: bigint) => {
        try {
            setRestoringRevisionId(revisionId);
            await restoreAiWorkspaceSettingsRevision({ revisionId });
            toast.success('Workspace settings restored');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to restore');
        } finally {
            setRestoringRevisionId(null);
        }
    };

    const field = (key: keyof typeof form) => ({
        value: form[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    });

    return (
        <AIWorkspacePage page="settings">
            {/* Header */}
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                Settings
            </Typography>

            {/* Current posture summary */}
            <Typography variant="caption" sx={{ color: '#555' }}>
                {findLabel(autonomyOptions, aiSettings?.autonomyPosture || form.autonomyPosture)} mode •{' '}
                {findLabel(fallbackOptions, aiSettings?.fallbackMode || form.fallbackMode)} fallback •{' '}
                {savedIntegrations.length} connected system{savedIntegrations.length !== 1 ? 's' : ''}
            </Typography>

            {/* Form */}
            <Stack component="form" spacing={2.5} onSubmit={handleSave} sx={{ maxWidth: 640 }}>
                <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: '#858585', fontWeight: 600 }}>General</Typography>
                    <TextField size="small" label="Default model" {...field('defaultModel')} helperText="Base model family for new agents." />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField select size="small" label="Autonomy level" {...field('autonomyPosture')} sx={{ flex: 1 }}
                            helperText={autonomyOptions.find((o) => o.value === form.autonomyPosture)?.description}>
                            {autonomyOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Fallback behavior" {...field('fallbackMode')} sx={{ flex: 1 }}
                            helperText={fallbackOptions.find((o) => o.value === form.fallbackMode)?.description}>
                            {fallbackOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                    </Stack>
                </Stack>

                <Divider sx={{ borderColor: '#1a1a1a' }} />

                <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: '#858585', fontWeight: 600 }}>Approval guardrails</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField select size="small" label="External actions" {...field('externalSendPolicy')} sx={{ flex: 1 }}
                            helperText={policyOptions.find((o) => o.value === form.externalSendPolicy)?.description}>
                            {policyOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Budget changes" {...field('budgetChangePolicy')} sx={{ flex: 1 }}
                            helperText={policyOptions.find((o) => o.value === form.budgetChangePolicy)?.description}>
                            {policyOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Internal notes" {...field('internalNotesPolicy')} sx={{ flex: 1 }}
                            helperText={policyOptions.find((o) => o.value === form.internalNotesPolicy)?.description}>
                            {policyOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                    </Stack>
                </Stack>

                <Divider sx={{ borderColor: '#1a1a1a' }} />

                <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: '#858585', fontWeight: 600 }}>Cost & audit</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField size="small" label="Max run cost (USD)" type="number" {...field('maxRunCostUsd')} sx={{ flex: 1 }}
                            helperText="Stop any single run exceeding this cost." />
                        <TextField size="small" label="Audit retention (days)" type="number" {...field('auditRetentionDays')} sx={{ flex: 1 }}
                            helperText="How long to keep AI run records." />
                    </Stack>
                    <TextField size="small" label="Connected systems" {...field('integrations')}
                        helperText="Comma-separated: calendar, docs, email, crm…" />
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    {!isOwner && (
                        <Typography variant="caption" sx={{ color: '#555' }}>Owner access required to save.</Typography>
                    )}
                    <Button type="submit" variant="contained" disabled={!isOwner || currentOrgId == null} sx={{ textTransform: 'none', ml: 'auto' }}>
                        Save settings
                    </Button>
                </Stack>
            </Stack>

            {/* Recent changes */}
            {recentChanges.length > 0 && (
                <Stack spacing={1} sx={{ maxWidth: 640 }}>
                    <Divider sx={{ borderColor: '#1a1a1a' }} />
                    <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent changes</Typography>
                    {recentChanges.map((event) => (
                        <Stack key={event.id.toString()} direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: '#858585' }}>{event.description}</Typography>
                            <Typography variant="caption" sx={{ color: '#444' }}>{formatBigIntDateTime(event.createdAt)}</Typography>
                        </Stack>
                    ))}
                </Stack>
            )}

            {/* Revision history */}
            {settingsRevisions.length > 0 && (
                <Stack spacing={1} sx={{ maxWidth: 640 }}>
                    <Divider sx={{ borderColor: '#1a1a1a' }} />
                    <AIRevisionHistoryCard
                        eyebrow="Restore point"
                        title="Configuration revision history"
                        description="Roll back a settings change without rebuilding from scratch."
                        revisions={settingsRevisions}
                        emptyMessage="No revisions recorded yet."
                        summarizeRevision={summarizeWorkspaceRevision}
                        badgesForRevision={badgesForWorkspaceRevision}
                        onRestore={isOwner ? handleRestoreRevision : undefined}
                        restoringRevisionId={restoringRevisionId}
                        canRestore={isOwner}
                    />
                </Stack>
            )}
        </AIWorkspacePage>
    );
}

export const AiSettingsPage = AISettingsPage;
