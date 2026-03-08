import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIInfoRow, AIPageIntro, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIWorkspacePage } from './AIPrimitives';
import { AIRevisionHistoryCard } from './AIRevisionHistoryCard';
import { formatBigIntDateTime, parseJsonList } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const autonomyOptions = [
    {
        value: 'manual',
        label: 'Manual only',
        description: 'Agents wait for a person before taking important actions.',
    },
    {
        value: 'guarded',
        label: 'Guarded autonomy',
        description: 'Agents can work ahead, but sensitive actions still stop for review.',
    },
    {
        value: 'autonomous',
        label: 'High autonomy',
        description: 'Agents are allowed to execute more steps without waiting for approval.',
    },
] as const;

const fallbackOptions = [
    {
        value: 'human-first',
        label: 'Hand off to a person',
        description: 'Escalate to a teammate as soon as something looks wrong.',
    },
    {
        value: 'queue-only',
        label: 'Queue for later',
        description: 'Leave the work in queue until someone reviews it.',
    },
    {
        value: 'retry-then-human',
        label: 'Retry, then hand off',
        description: 'Try one more automated pass before escalating.',
    },
] as const;

const policyOptions = [
    {
        value: 'manual_approval',
        label: 'Always ask first',
        description: 'Nothing in this category is sent without approval.',
    },
    {
        value: 'owner_review',
        label: 'Owner review',
        description: 'Send the decision to an owner before execution.',
    },
    {
        value: 'auto_allowed',
        label: 'Allow automatically',
        description: 'This category can run without waiting for a person.',
    },
] as const;

const integrationLabels: Record<string, string> = {
    calendar: 'Calendar',
    crm: 'CRM',
    docs: 'Docs',
    email: 'Email',
    files: 'Files',
    meetings: 'Meetings',
    proposals: 'Proposals',
    presentations: 'Presentations',
    research: 'Research',
};

function findOptionLabel(
    options: readonly { value: string; label: string; description: string }[],
    value: string
) {
    return options.find((option) => option.value === value)?.label || value;
}

function findOptionDescription(
    options: readonly { value: string; label: string; description: string }[],
    value: string
) {
    return options.find((option) => option.value === value)?.description || '';
}

function toIntegrationSummary(values: string[]) {
    if (values.length === 0) return 'No connected systems declared yet.';
    return values.map((value) => integrationLabels[value] || value).join(', ');
}

function parseConfigRevisionMetadata(value: string): Record<string, string> {
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

function summarizeWorkspaceRevision(revision: { payloadJson: string }) {
    try {
        const parsed = JSON.parse(revision.payloadJson) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return 'Saved workspace settings snapshot';
        }
        let integrationCount = 0;
        if (typeof parsed.integrations_json === 'string') {
            try {
                const integrations = JSON.parse(parsed.integrations_json);
                integrationCount = Array.isArray(integrations) ? integrations.length : 0;
            } catch {
                integrationCount = 0;
            }
        }
        return [
            typeof parsed.default_model === 'string' ? parsed.default_model : null,
            typeof parsed.autonomy_posture === 'string' ? findOptionLabel(autonomyOptions, parsed.autonomy_posture) : null,
            typeof parsed.fallback_mode === 'string' ? findOptionLabel(fallbackOptions, parsed.fallback_mode) : null,
            integrationCount > 0 ? `${integrationCount} connected system${integrationCount === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' • ') || 'Saved workspace settings snapshot';
    } catch {
        return 'Saved workspace settings snapshot';
    }
}

function badgesForWorkspaceRevision(revision: { metadataJson: string }) {
    const metadata = parseConfigRevisionMetadata(revision.metadataJson);
    const badges: Array<{ label: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = [];

    if (metadata.default_model) {
        badges.push({ label: metadata.default_model, tone: 'neutral' });
    }
    if (metadata.autonomy_posture) {
        badges.push({ label: findOptionLabel(autonomyOptions, metadata.autonomy_posture), tone: 'warning' });
    }
    if (metadata.restored_from_revision_id) {
        badges.push({ label: `Restored from ${metadata.restored_from_revision_id}`, tone: 'success' });
    }

    return badges;
}

export function AISettingsPage() {
    const {
        currentOrgId,
        isOwner,
        aiActivities,
        aiConfigRevisions,
        aiSettings,
    } = useAIWorkspaceData();

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

    const savedIntegrations = useMemo(
        () => parseJsonList(aiSettings?.integrationsJson || JSON.stringify(form.integrations.split(',').map((item) => item.trim()).filter(Boolean))),
        [aiSettings?.integrationsJson, form.integrations]
    );

    const recentChanges = [...aiActivities]
        .filter((event) => event.eventType === 'workspace_settings_updated')
        .sort((left, right) => Number(right.createdAt - left.createdAt))
        .slice(0, 4);

    const currentAutonomyLabel = findOptionLabel(autonomyOptions, aiSettings?.autonomyPosture || form.autonomyPosture);
    const currentFallbackLabel = findOptionLabel(fallbackOptions, aiSettings?.fallbackMode || form.fallbackMode);
    const currentExternalPolicyLabel = findOptionLabel(policyOptions, aiSettings?.externalSendPolicy || form.externalSendPolicy);
    const currentBudgetPolicyLabel = findOptionLabel(policyOptions, aiSettings?.budgetChangePolicy || form.budgetChangePolicy);
    const currentNotesPolicyLabel = findOptionLabel(policyOptions, aiSettings?.internalNotesPolicy || form.internalNotesPolicy);
    const maxRunCostUsd = aiSettings ? (Number(aiSettings.maxRunCostMicrousd) / 1_000_000).toFixed(2) : Number(form.maxRunCostUsd || '0').toFixed(2);
    const settingsRevisions = [...aiConfigRevisions]
        .filter((revision) => revision.scopeType === 'workspace_settings' && revision.scopeId === currentOrgId)
        .sort((left, right) => Number(right.createdAt - left.createdAt))
        .slice(0, 8);
    const [restoringRevisionId, setRestoringRevisionId] = useState<bigint | null>(null);

    const operatingSummary = [
        `Agents operate in ${currentAutonomyLabel.toLowerCase()}.`,
        `If something fails, the workspace uses "${currentFallbackLabel.toLowerCase()}".`,
        `External actions currently use "${currentExternalPolicyLabel.toLowerCase()}".`,
    ];

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
                integrationsJson: JSON.stringify(
                    form.integrations
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                ),
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
            toast.error(error instanceof Error ? error.message : 'Failed to restore workspace settings');
        } finally {
            setRestoringRevisionId(null);
        }
    };

    return (
        <AIWorkspacePage page="settings">
            <AIPageIntro
                eyebrow="Settings"
                title="Run the AI control plane with clear guardrails"
                description="This page controls how the workspace AI behaves: how much freedom agents have, when human review is required, how much a run can spend, and which systems the workspace is allowed to touch."
                supportingCopy="Keep the page readable for operators. The goal is to describe how the workspace should run, not to expose internal database labels."
            />

            <AIStatGrid>
                <AIStatCard label="Operating mode" value={currentAutonomyLabel} caption={findOptionDescription(autonomyOptions, aiSettings?.autonomyPosture || form.autonomyPosture)} tone="info" />
                <AIStatCard label="External actions" value={currentExternalPolicyLabel} caption="Current rule for emails and outside-facing actions" tone="warning" />
                <AIStatCard label="Run guardrail" value={`$${maxRunCostUsd}`} caption="Maximum allowed cost for a single run" tone="success" />
                <AIStatCard label="Connected systems" value={String(savedIntegrations.length)} caption={toIntegrationSummary(savedIntegrations)} tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Overview" title="How the workspace behaves today" description="Read this first before changing anything. It summarizes the live control-plane posture in plain language.">
                    <Stack spacing={1.4}>
                        {operatingSummary.map((line) => (
                            <Typography key={line} variant="body2" sx={{ color: '#ffffff', lineHeight: 1.7 }}>
                                {line}
                            </Typography>
                        ))}
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            Budget changes use {currentBudgetPolicyLabel.toLowerCase()}, internal notes use {currentNotesPolicyLabel.toLowerCase()}, and audit records are kept for {aiSettings?.auditRetentionDays.toString() || form.auditRetentionDays} days.
                        </Typography>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Workspace defaults" title="Choose the default operating posture" description="These settings define how new agents and automated flows should behave unless a more specific rule overrides them.">
                    <Stack component="form" spacing={1.6} onSubmit={handleSave}>
                        <TextField
                            size="small"
                            label="Default model"
                            value={form.defaultModel}
                            onChange={(event) => setForm((current) => ({ ...current, defaultModel: event.target.value }))}
                            helperText="This is the base model family new agents should use first."
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Autonomy level"
                                value={form.autonomyPosture}
                                onChange={(event) => setForm((current) => ({ ...current, autonomyPosture: event.target.value }))}
                                helperText={findOptionDescription(autonomyOptions, form.autonomyPosture)}
                                sx={{ minWidth: 220 }}
                            >
                                {autonomyOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Fallback behavior"
                                value={form.fallbackMode}
                                onChange={(event) => setForm((current) => ({ ...current, fallbackMode: event.target.value }))}
                                helperText={findOptionDescription(fallbackOptions, form.fallbackMode)}
                                sx={{ minWidth: 220 }}
                            >
                                {fallbackOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        <Typography variant="body2" sx={{ color: '#d5d5d5', fontWeight: 600 }}>
                            Approval guardrails
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="External actions"
                                value={form.externalSendPolicy}
                                onChange={(event) => setForm((current) => ({ ...current, externalSendPolicy: event.target.value }))}
                                helperText={findOptionDescription(policyOptions, form.externalSendPolicy)}
                                sx={{ minWidth: 220 }}
                            >
                                {policyOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Budget changes"
                                value={form.budgetChangePolicy}
                                onChange={(event) => setForm((current) => ({ ...current, budgetChangePolicy: event.target.value }))}
                                helperText={findOptionDescription(policyOptions, form.budgetChangePolicy)}
                                sx={{ minWidth: 220 }}
                            >
                                {policyOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Internal notes"
                                value={form.internalNotesPolicy}
                                onChange={(event) => setForm((current) => ({ ...current, internalNotesPolicy: event.target.value }))}
                                helperText={findOptionDescription(policyOptions, form.internalNotesPolicy)}
                                sx={{ minWidth: 220 }}
                            >
                                {policyOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        <Typography variant="body2" sx={{ color: '#d5d5d5', fontWeight: 600 }}>
                            Cost and audit limits
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                size="small"
                                label="Audit retention (days)"
                                type="number"
                                value={form.auditRetentionDays}
                                onChange={(event) => setForm((current) => ({ ...current, auditRetentionDays: event.target.value }))}
                                helperText="How long the workspace should keep AI run records."
                            />
                            <TextField
                                size="small"
                                label="Max run cost (USD)"
                                type="number"
                                value={form.maxRunCostUsd}
                                onChange={(event) => setForm((current) => ({ ...current, maxRunCostUsd: event.target.value }))}
                                helperText="Stop any single run from spending more than this amount."
                            />
                        </Stack>

                        <TextField
                            size="small"
                            label="Connected systems"
                            value={form.integrations}
                            onChange={(event) => setForm((current) => ({ ...current, integrations: event.target.value }))}
                            helperText="Comma-separated integration ids, for example calendar, docs, email, crm."
                        />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                {isOwner ? 'Only owners can change control-plane rules.' : 'You need owner access to save control-plane rules.'}
                            </Typography>
                            <Button type="submit" variant="contained" disabled={!isOwner || currentOrgId == null} sx={{ textTransform: 'none' }}>
                                Save control-plane settings
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Policy summary" title="Current rules at a glance" description="This is the shortest readable version of the saved rules for the workspace.">
                    <Stack spacing={0}>
                        <AIInfoRow label="Autonomy level" value={currentAutonomyLabel} tone="info" />
                        <AIInfoRow label="Fallback behavior" value={currentFallbackLabel} tone="warning" />
                        <AIInfoRow label="External actions" value={currentExternalPolicyLabel} tone="danger" />
                        <AIInfoRow label="Budget changes" value={currentBudgetPolicyLabel} tone="warning" />
                        <AIInfoRow label="Internal notes" value={currentNotesPolicyLabel} tone="success" />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Connected systems" title="Where agents are allowed to work" description="This is the current list of systems the workspace says AI can interact with.">
                    <Stack spacing={0}>
                        <AIInfoRow label="Declared systems" value={savedIntegrations.length === 0 ? 'None configured' : toIntegrationSummary(savedIntegrations)} tone="neutral" />
                        <AIInfoRow label="Primary model family" value={aiSettings?.defaultModel || form.defaultModel} tone="info" />
                        <AIInfoRow label="Audit retention" value={`${aiSettings?.auditRetentionDays.toString() || form.auditRetentionDays} days`} tone="neutral" />
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Change log" title="Recent settings updates" description="Every workspace-level AI settings change is already recorded in the AI activity feed.">
                    <Stack spacing={1.1}>
                        {recentChanges.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No settings changes have been recorded yet.
                            </Typography>
                        ) : recentChanges.map((event) => (
                            <Stack key={event.id.toString()} spacing={0.25}>
                                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                    {event.description}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585' }}>
                                    {formatBigIntDateTime(event.createdAt)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AIRevisionHistoryCard
                    eyebrow="Restore point"
                    title="Configuration revision history"
                    description="Use this when a settings change needs to be rolled back without rebuilding the workspace rules by hand."
                    revisions={settingsRevisions}
                    emptyMessage="No workspace-setting revisions have been recorded yet."
                    summarizeRevision={summarizeWorkspaceRevision}
                    badgesForRevision={badgesForWorkspaceRevision}
                    onRestore={isOwner ? handleRestoreRevision : undefined}
                    restoringRevisionId={restoringRevisionId}
                    canRestore={isOwner}
                />
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiSettingsPage = AISettingsPage;
