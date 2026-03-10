import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AIWorkspacePage } from './AIPrimitives';
import { formatUsd, microusdToUsd } from './aiUtils';
import { useAIWorkspaceData } from './useAIWorkspaceData';

type CostPreset = 'mtd' | '7d' | '30d' | 'ytd' | 'all';

const PRESET_LABELS: Record<CostPreset, string> = {
    mtd: 'Month to date',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    ytd: 'Year to date',
    all: 'All time',
};

function getPresetStart(preset: CostPreset, now: Date) {
    switch (preset) {
        case 'mtd': return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        case '7d': return now.getTime() - 7 * 24 * 60 * 60 * 1000;
        case '30d': return now.getTime() - 30 * 24 * 60 * 60 * 1000;
        case 'ytd': return new Date(now.getFullYear(), 0, 1).getTime();
        default: return 0;
    }
}

function dayKey(value: bigint) {
    return new Date(Number(value)).toISOString().slice(0, 10);
}

function getLast7DayKeys(now: number) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
    });
}

export function AICostsPage() {
    const { aiAgents, aiProjects, aiRuns, aiSettings } = useAIWorkspaceData();

    const [preset, setPreset] = useState<CostPreset>('mtd');

    const now = Date.now();
    const start = getPresetStart(preset, new Date(now));
    const scopedRuns = aiRuns.filter((r) => Number(r.createdAt) >= start);
    const spend = scopedRuns.reduce((s, r) => s + microusdToUsd(r.costMicrousd), 0);
    const completed = scopedRuns.filter((r) => r.status === 'completed');
    const failed = scopedRuns.filter((r) => r.status === 'failed');
    const avgPerRun = scopedRuns.length === 0 ? 0 : spend / scopedRuns.length;
    const runGuardrail = aiSettings ? microusdToUsd(aiSettings.maxRunCostMicrousd) : 0;

    const byAgent = aiAgents
        .map((agent) => {
            const runs = scopedRuns.filter((r) => r.agentId === agent.id);
            const total = runs.reduce((s, r) => s + microusdToUsd(r.costMicrousd), 0);
            return { agent, runs, total, failed: runs.filter((r) => r.status === 'failed').length };
        })
        .filter((r) => r.runs.length > 0)
        .sort((a, b) => b.total - a.total);

    const byProject = aiProjects
        .map((project) => {
            const projectAgents = aiAgents.filter((a) => a.projectId === project.id);
            const runs = scopedRuns.filter((r) => projectAgents.some((a) => a.id === r.agentId));
            const total = runs.reduce((s, r) => s + microusdToUsd(r.costMicrousd), 0);
            return { project, runs, total, failed: runs.filter((r) => r.status === 'failed').length };
        })
        .filter((r) => r.runs.length > 0)
        .sort((a, b) => b.total - a.total);

    const trendKeys = getLast7DayKeys(now);
    const trend = trendKeys.map((k) => {
        const dayRuns = scopedRuns.filter((r) => dayKey(r.createdAt) === k);
        return {
            key: k,
            label: new Date(`${k}T12:00:00`).toLocaleDateString([], { weekday: 'short' }),
            total: dayRuns.reduce((s, r) => s + microusdToUsd(r.costMicrousd), 0),
            count: dayRuns.length,
        };
    });
    const maxTrend = Math.max(...trend.map((r) => r.total), 0);

    return (
        <AIWorkspacePage page="costs">
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                    Costs
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    {(Object.keys(PRESET_LABELS) as CostPreset[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => setPreset(key)}
                            style={{
                                padding: '4px 10px',
                                border: '1px solid',
                                borderColor: preset === key ? '#fff' : '#1a1a1a',
                                borderRadius: 4,
                                background: 'none',
                                cursor: 'pointer',
                                color: preset === key ? '#fff' : '#555',
                                fontSize: '0.75rem',
                            }}
                        >
                            {PRESET_LABELS[key]}
                        </button>
                    ))}
                </Stack>
            </Stack>

            {/* Summary row */}
            <Stack direction="row" spacing={3} sx={{ borderBottom: '1px solid #1a1a1a', pb: 2 }}>
                <Stack spacing={0.25}>
                    <Typography variant="caption" sx={{ color: '#555' }}>Spend</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1 }}>{formatUsd(spend)}</Typography>
                    <Typography variant="caption" sx={{ color: '#555' }}>{scopedRuns.length} runs</Typography>
                </Stack>
                <Stack spacing={0.25}>
                    <Typography variant="caption" sx={{ color: '#555' }}>Avg / run</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1 }}>{formatUsd(avgPerRun)}</Typography>
                    <Typography variant="caption" sx={{ color: '#555' }}>{completed.length} completed, {failed.length} failed</Typography>
                </Stack>
                {runGuardrail > 0 && (
                    <Stack spacing={0.25}>
                        <Typography variant="caption" sx={{ color: '#555' }}>Run guardrail</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1 }}>{formatUsd(runGuardrail)}</Typography>
                        <Typography variant="caption" sx={{ color: '#555' }}>max per run</Typography>
                    </Stack>
                )}
            </Stack>

            {/* 7-day trend */}
            {maxTrend > 0 && (
                <Stack spacing={1}>
                    <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>7-day trend</Typography>
                    <Stack spacing={0.75}>
                        {trend.map((row) => (
                            <Stack key={row.key} direction="row" alignItems="center" spacing={1.5}>
                                <Typography variant="caption" sx={{ color: '#555', width: 28 }}>{row.label}</Typography>
                                <Box sx={{ flex: 1, height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <Box sx={{ width: `${row.total === 0 ? 0 : (row.total / maxTrend) * 100}%`, height: '100%', borderRadius: '999px', bgcolor: '#38c872' }} />
                                </Box>
                                <Typography variant="caption" sx={{ color: '#555', minWidth: 60, textAlign: 'right' }}>
                                    {formatUsd(row.total)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#333', minWidth: 40, textAlign: 'right' }}>
                                    {row.count}r
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Stack>
            )}

            {/* By agent */}
            {byAgent.length > 0 && (
                <Stack spacing={1}>
                    <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By agent</Typography>
                    <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                        {byAgent.slice(0, 10).map((row, i) => (
                            <Stack
                                key={row.agent.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: i < byAgent.length - 1 ? '1px solid #1a1a1a' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Stack spacing={0.15}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{row.agent.name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{row.agent.role} • {row.runs.length} runs</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    {row.failed > 0 && (
                                        <Typography variant="caption" sx={{ color: '#ef4444' }}>{row.failed} failed</Typography>
                                    )}
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{formatUsd(row.total)}</Typography>
                                </Stack>
                            </Stack>
                        ))}
                    </Box>
                </Stack>
            )}

            {/* By project */}
            {byProject.length > 0 && (
                <Stack spacing={1}>
                    <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By project</Typography>
                    <Box sx={{ border: '1px solid #1a1a1a', borderRadius: 1 }}>
                        {byProject.slice(0, 6).map((row, i) => (
                            <Stack
                                key={row.project.id.toString()}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: i < byProject.length - 1 ? '1px solid #1a1a1a' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.018)' },
                                }}
                            >
                                <Stack spacing={0.15}>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{row.project.name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#555' }}>{row.runs.length} runs</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    {row.failed > 0 && (
                                        <Typography variant="caption" sx={{ color: '#ef4444' }}>{row.failed} failed</Typography>
                                    )}
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{formatUsd(row.total)}</Typography>
                                </Stack>
                            </Stack>
                        ))}
                    </Box>
                </Stack>
            )}

            {byAgent.length === 0 && byProject.length === 0 && (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#555' }}>
                        No cost data recorded in {PRESET_LABELS[preset].toLowerCase()}.
                    </Typography>
                </Box>
            )}
        </AIWorkspacePage>
    );
}

export const AiCostsPage = AICostsPage;
