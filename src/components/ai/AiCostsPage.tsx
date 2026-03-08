import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { formatUsd, microusdToUsd } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type CostPreset = 'mtd' | '7d' | '30d' | 'ytd' | 'all';

const presetLabels: Record<CostPreset, string> = {
    mtd: 'Month to date',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    ytd: 'Year to date',
    all: 'All time',
};

function getPresetStart(preset: CostPreset, now: Date) {
    switch (preset) {
        case 'mtd':
            return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        case '7d':
            return now.getTime() - (7 * 24 * 60 * 60 * 1000);
        case '30d':
            return now.getTime() - (30 * 24 * 60 * 60 * 1000);
        case 'ytd':
            return new Date(now.getFullYear(), 0, 1).getTime();
        case 'all':
        default:
            return 0;
    }
}

function getLastSevenDayKeys(now: number) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        return date.toISOString().slice(0, 10);
    });
}

function dayKeyFromBigInt(value: bigint) {
    return new Date(Number(value)).toISOString().slice(0, 10);
}

export function AICostsPage() {
    const {
        aiAgents,
        aiProjects,
        aiRuns,
        aiSettings,
    } = useAIWorkspaceData();

    const [preset, setPreset] = useState<CostPreset>('mtd');

    const now = Date.now();
    const start = getPresetStart(preset, new Date(now));

    const scopedRuns = aiRuns.filter((run) => Number(run.createdAt) >= start);
    const spend = scopedRuns.reduce((total, run) => total + microusdToUsd(run.costMicrousd), 0);
    const completedRuns = scopedRuns.filter((run) => run.status === 'completed');
    const failedRuns = scopedRuns.filter((run) => run.status === 'failed');
    const avgCostPerRun = scopedRuns.length === 0
        ? 0
        : spend / scopedRuns.length;
    const avgCostPerCompletedRun = completedRuns.length === 0
        ? 0
        : completedRuns.reduce((total, run) => total + microusdToUsd(run.costMicrousd), 0) / completedRuns.length;
    const runGuardrail = aiSettings ? microusdToUsd(aiSettings.maxRunCostMicrousd) : 0;
    const utilizationPct = runGuardrail > 0 ? Math.min(100, Math.round((avgCostPerRun / runGuardrail) * 100)) : 0;

    const spendByAgent = aiAgents
        .map((agent) => {
            const runs = scopedRuns.filter((run) => run.agentId === agent.id);
            const total = runs.reduce((sum, run) => sum + microusdToUsd(run.costMicrousd), 0);
            return {
                agent,
                runs,
                total,
                failedCount: runs.filter((run) => run.status === 'failed').length,
                avgCost: runs.length === 0 ? 0 : total / runs.length,
            };
        })
        .filter((row) => row.total > 0 || row.runs.length > 0)
        .sort((left, right) => right.total - left.total);

    const spendByProject = aiProjects
        .map((project) => {
            const projectAgents = aiAgents.filter((agent) => agent.projectId === project.id);
            const projectRuns = scopedRuns.filter((run) => projectAgents.some((agent) => agent.id === run.agentId));
            const total = projectRuns.reduce((sum, run) => sum + microusdToUsd(run.costMicrousd), 0);
            return {
                project,
                projectAgents,
                projectRuns,
                total,
                failedCount: projectRuns.filter((run) => run.status === 'failed').length,
            };
        })
        .filter((row) => row.total > 0 || row.projectRuns.length > 0)
        .sort((left, right) => right.total - left.total);

    const spendTrend = getLastSevenDayKeys(now).map((dayKey) => {
        const dayRuns = scopedRuns.filter((run) => dayKeyFromBigInt(run.createdAt) === dayKey);
        const total = dayRuns.reduce((sum, run) => sum + microusdToUsd(run.costMicrousd), 0);
        return {
            key: dayKey,
            label: new Date(`${dayKey}T12:00:00`).toLocaleDateString([], { weekday: 'short' }),
            total,
            runCount: dayRuns.length,
        };
    });

    const topAgent = spendByAgent[0] ?? null;
    const topProject = spendByProject[0] ?? null;
    const maxTrend = Math.max(...spendTrend.map((row) => row.total), 0);

    return (
        <AIWorkspacePage page="costs">
            <AIPageIntro
                eyebrow="Costs"
                title="Track AI spend like an operating budget"
                description="This page now behaves more like a control surface: filter the run ledger by range, compare against guardrails, and see which agents and projects are driving cost."
                actionSlot={
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {(Object.keys(presetLabels) as CostPreset[]).map((key) => (
                            <Button
                                key={key}
                                variant={preset === key ? 'contained' : 'outlined'}
                                sx={{ textTransform: 'none' }}
                                onClick={() => setPreset(key)}
                            >
                                {presetLabels[key]}
                            </Button>
                        ))}
                    </Stack>
                }
            />

            <AIStatGrid>
                <AIStatCard label="Spend in range" value={formatUsd(spend)} caption={`${scopedRuns.length} runs in ${presetLabels[preset].toLowerCase()}`} tone="info" />
                <AIStatCard label="Average / run" value={formatUsd(avgCostPerRun)} caption={`${completedRuns.length} completed • ${failedRuns.length} failed`} tone="success" />
                <AIStatCard label="Run guardrail" value={runGuardrail > 0 ? formatUsd(runGuardrail) : 'Not set'} caption="Workspace maximum allowed cost per run" tone="warning" />
                <AIStatCard label="Top spender" value={topAgent ? topAgent.agent.name : 'No spend'} caption={topAgent ? formatUsd(topAgent.total) : 'No cost events recorded in this range'} tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard eyebrow="Budget" title="Budget pressure" description="This reads the current range against the workspace run guardrail.">
                    <Stack spacing={1.6}>
                        <AIProgressRow
                            label="Average run cost vs guardrail"
                            value={utilizationPct}
                            detail={runGuardrail > 0 ? `${formatUsd(avgCostPerRun)} of ${formatUsd(runGuardrail)}` : 'No run guardrail configured'}
                            tone={utilizationPct >= 85 ? 'danger' : utilizationPct >= 60 ? 'warning' : 'success'}
                        />
                        <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                            Use this as an operator signal, not a finance close. It is based on recorded AI runs currently loaded into the workspace.
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <AIStatusPill label={`${failedRuns.length} failed runs`} tone={failedRuns.length > 0 ? 'danger' : 'success'} />
                            <AIStatusPill label={`${formatUsd(avgCostPerCompletedRun)} avg completed`} tone="info" />
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Trend" title="Seven-day spend trend" description="This keeps the spend story visible without needing a full chart library.">
                    <Stack spacing={1.15}>
                        {maxTrend === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No run costs were recorded in the selected range.
                            </Typography>
                        ) : spendTrend.map((row) => (
                            <Stack key={row.key} spacing={0.45}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                                        {row.label}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {formatUsd(row.total)} • {row.runCount} runs
                                    </Typography>
                                </Stack>
                                <Stack
                                    sx={{
                                        height: 8,
                                        borderRadius: '999px',
                                        bgcolor: 'rgba(255,255,255,0.06)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <Stack
                                        sx={{
                                            width: `${row.total === 0 ? 0 : (row.total / maxTrend) * 100}%`,
                                            height: '100%',
                                            borderRadius: '999px',
                                            bgcolor: '#38c872',
                                        }}
                                    />
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Agents" title="Highest spenders" description="These rows show who is consuming budget and how healthy the work is.">
                    <Stack spacing={1.1}>
                        {spendByAgent.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No agent spend is recorded in the selected range.
                            </Typography>
                        ) : spendByAgent.slice(0, 6).map((row) => (
                            <Stack
                                key={row.agent.id.toString()}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.35,
                                    borderRadius: '14px',
                                    border: '1px solid #1a1a1a',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.35}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {row.agent.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {row.agent.role} • {row.runs.length} runs • avg {formatUsd(row.avgCost)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
                                    <AIStatusPill label={formatUsd(row.total)} tone="info" />
                                    {row.failedCount > 0 ? <AIStatusPill label={`${row.failedCount} failed`} tone="danger" /> : null}
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </AISectionCard>

                <AISectionCard eyebrow="Projects" title="Project cost rollup" description="Roll up agent spend into projects so operators can see which workstreams are absorbing budget.">
                    <Stack spacing={1.1}>
                        {spendByProject.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No project-attributed spend is recorded in the selected range.
                            </Typography>
                        ) : spendByProject.slice(0, 6).map((row) => (
                            <Stack
                                key={row.project.id.toString()}
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    p: 1.35,
                                    borderRadius: '14px',
                                    border: '1px solid #1a1a1a',
                                    bgcolor: 'rgba(255,255,255,0.015)',
                                }}
                            >
                                <Stack spacing={0.35}>
                                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {row.project.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#858585' }}>
                                        {row.projectAgents.length} agents • {row.projectRuns.length} runs
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
                                    <AIStatusPill label={formatUsd(row.total)} tone="success" />
                                    {row.failedCount > 0 ? <AIStatusPill label={`${row.failedCount} failed`} tone="danger" /> : null}
                                </Stack>
                            </Stack>
                        ))}
                        {topProject ? (
                            <Typography variant="caption" sx={{ color: '#666666' }}>
                                Highest-spend workstream in this range: {topProject.project.name} at {formatUsd(topProject.total)}.
                            </Typography>
                        ) : null}
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiCostsPage = AICostsPage;
