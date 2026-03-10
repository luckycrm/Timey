import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ---------------------------------------------------------------------------
// Shared design tokens (mirrors chatColors / toneMap patterns)
// ---------------------------------------------------------------------------
const CARD_BG = 'rgba(255,255,255,0.03)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)';
const CARD_RADIUS = '14px';
const CARD_PADDING = '16px';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#858585';

// ---------------------------------------------------------------------------
// Helper: group runs by day key (YYYY-MM-DD)
// ---------------------------------------------------------------------------
function dayKey(microseconds: bigint): string {
    return new Date(Number(microseconds)).toISOString().slice(0, 10);
}

function getLast14DayKeys(now: number): string[] {
    return Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (13 - i));
        return d.toISOString().slice(0, 10);
    });
}

function shortDayLabel(dayKeyStr: string): string {
    return new Date(`${dayKeyStr}T12:00:00`).toLocaleDateString([], { weekday: 'short' });
}

// ---------------------------------------------------------------------------
// 1. AiRunActivityChart — bar chart, 14 days, red if any failed, green if all ok
// ---------------------------------------------------------------------------
export interface AiRunActivityChartProps {
    runs: Array<{ createdAt: bigint; status: string }>;
}

export function AiRunActivityChart({ runs }: AiRunActivityChartProps) {
    const now = Date.now();
    const keys = getLast14DayKeys(now);

    const bars = keys.map((k) => {
        const dayRuns = runs.filter((r) => dayKey(r.createdAt) === k);
        const hasFailed = dayRuns.some((r) => r.status === 'failed');
        return {
            key: k,
            label: shortDayLabel(k),
            count: dayRuns.length,
            hasFailed,
        };
    });

    const maxCount = Math.max(...bars.map((b) => b.count), 1);
    const chartH = 80;
    const barW = 12;
    const gap = 4;
    const totalW = bars.length * (barW + gap) - gap;

    return (
        <Box
            sx={{
                bgcolor: CARD_BG,
                border: CARD_BORDER,
                borderRadius: CARD_RADIUS,
                p: CARD_PADDING,
            }}
        >
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Run activity
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontWeight: 600, mt: 0.5, mb: 1.5 }}>
                Last 14 days
            </Typography>

            <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <svg
                    width={totalW}
                    height={chartH + 22}
                    style={{ display: 'block', minWidth: '100%' }}
                    viewBox={`0 0 ${totalW} ${chartH + 22}`}
                    preserveAspectRatio="none"
                >
                    {bars.map((bar, i) => {
                        const barH = bar.count === 0 ? 2 : Math.max(4, Math.round((bar.count / maxCount) * chartH));
                        const x = i * (barW + gap);
                        const y = chartH - barH;
                        const fill = bar.count === 0
                            ? 'rgba(255,255,255,0.08)'
                            : bar.hasFailed
                                ? '#e33d4f'
                                : '#38c872';
                        return (
                            <g key={bar.key}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={barW}
                                    height={barH}
                                    rx={3}
                                    fill={fill}
                                    opacity={bar.count === 0 ? 0.4 : 1}
                                />
                                {/* label every 3rd bar */}
                                {i % 3 === 0 && (
                                    <text
                                        x={x + barW / 2}
                                        y={chartH + 16}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fill="#858585"
                                    >
                                        {bar.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </Box>

            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#38c872' }} />
                    <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>All ok</Typography>
                </Stack>
                <Stack direction="row" spacing={0.6} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#e33d4f' }} />
                    <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>Had failures</Typography>
                </Stack>
            </Stack>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// 2. AiPriorityDistributionChart — horizontal bar chart per priority
// ---------------------------------------------------------------------------
export interface AiPriorityDistributionChartProps {
    tasks: Array<{ priority: string }>;
}

const PRIORITY_CONFIG: Array<{ key: string; label: string; color: string }> = [
    { key: 'urgent', label: 'Urgent', color: '#e33d4f' },
    { key: 'high',   label: 'High',   color: '#ff9800' },
    { key: 'normal', label: 'Normal', color: '#7eb0ff' },
    { key: 'low',    label: 'Low',    color: '#858585' },
];

export function AiPriorityDistributionChart({ tasks }: AiPriorityDistributionChartProps) {
    const counts = PRIORITY_CONFIG.map((cfg) => ({
        ...cfg,
        count: tasks.filter((t) => t.priority === cfg.key).length,
    }));
    const maxCount = Math.max(...counts.map((c) => c.count), 1);

    return (
        <Box
            sx={{
                bgcolor: CARD_BG,
                border: CARD_BORDER,
                borderRadius: CARD_RADIUS,
                p: CARD_PADDING,
            }}
        >
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Priority distribution
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontWeight: 600, mt: 0.5, mb: 1.5 }}>
                Tasks by urgency
            </Typography>

            <Stack spacing={1.1}>
                {counts.map((row) => (
                    <Stack key={row.key} spacing={0.4}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: TEXT_PRIMARY, fontWeight: 500 }}>
                                {row.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                                {row.count}
                            </Typography>
                        </Stack>
                        <Box sx={{ height: 8, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <Box
                                sx={{
                                    width: `${row.count === 0 ? 0 : Math.max(4, (row.count / maxCount) * 100)}%`,
                                    height: '100%',
                                    borderRadius: '999px',
                                    bgcolor: row.color,
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        </Box>
                    </Stack>
                ))}
            </Stack>

            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, mt: 1.5, display: 'block' }}>
                {tasks.length} total tasks
            </Typography>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// 3. AiStatusDonut — SVG donut chart for task status distribution
// ---------------------------------------------------------------------------
export interface AiStatusDonutProps {
    tasks: Array<{ status: string }>;
}

interface DonutSegment {
    key: string;
    label: string;
    color: string;
    count: number;
}

function buildDonutSegments(tasks: Array<{ status: string }>): DonutSegment[] {
    const groups: DonutSegment[] = [
        { key: 'running',          label: 'Running',          color: '#7eb0ff', count: 0 },
        { key: 'waiting_approval', label: 'Waiting approval', color: '#ff9800', count: 0 },
        { key: 'blocked_failed',   label: 'Blocked / failed', color: '#e33d4f', count: 0 },
        { key: 'completed',        label: 'Completed',        color: '#38c872', count: 0 },
        { key: 'queued',           label: 'Queued',           color: '#555555', count: 0 },
    ];

    for (const task of tasks) {
        if (task.status === 'running') {
            groups[0].count += 1;
        } else if (task.status === 'waiting_approval') {
            groups[1].count += 1;
        } else if (task.status === 'blocked' || task.status === 'failed') {
            groups[2].count += 1;
        } else if (task.status === 'completed') {
            groups[3].count += 1;
        } else {
            // queued, pending, unknown → bucket into queued
            groups[4].count += 1;
        }
    }

    return groups;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function AiStatusDonut({ tasks }: AiStatusDonutProps) {
    const segments = buildDonutSegments(tasks);
    const total = tasks.length;

    const cx = 60;
    const cy = 60;
    const r = 44;
    const strokeW = 14;

    let currentAngle = 0;
    const arcs = segments
        .filter((s) => s.count > 0)
        .map((s) => {
            const sweep = (s.count / Math.max(total, 1)) * 360;
            const start = currentAngle;
            const end = currentAngle + sweep - 1; // 1° gap
            currentAngle += sweep;
            return { ...s, start, end: Math.min(end, start + sweep) };
        });

    return (
        <Box
            sx={{
                bgcolor: CARD_BG,
                border: CARD_BORDER,
                borderRadius: CARD_RADIUS,
                p: CARD_PADDING,
            }}
        >
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Status breakdown
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontWeight: 600, mt: 0.5, mb: 1.5 }}>
                Task status donut
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ flexShrink: 0 }}>
                    <svg width={120} height={120} viewBox="0 0 120 120">
                        {/* background ring */}
                        <circle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth={strokeW}
                        />
                        {total === 0 ? (
                            <circle
                                cx={cx} cy={cy} r={r}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth={strokeW}
                            />
                        ) : arcs.map((arc) => {
                            const sweep = arc.end - arc.start;
                            if (sweep <= 0) return null;
                            return (
                                <path
                                    key={arc.key}
                                    d={describeArc(cx, cy, r, arc.start, arc.end)}
                                    fill="none"
                                    stroke={arc.color}
                                    strokeWidth={strokeW}
                                    strokeLinecap="butt"
                                />
                            );
                        })}
                        {/* center label */}
                        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill={TEXT_PRIMARY}>
                            {total}
                        </text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill={TEXT_SECONDARY}>
                            tasks
                        </text>
                    </svg>
                </Box>

                <Stack spacing={0.7} sx={{ minWidth: 0 }}>
                    {segments.map((seg) => (
                        <Stack key={seg.key} direction="row" spacing={0.8} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: seg.color, flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {seg.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: TEXT_PRIMARY, fontWeight: 600, flexShrink: 0 }}>
                                {seg.count}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </Stack>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// 4. AiSuccessRateCard — success rate with circular arc SVG progress
// ---------------------------------------------------------------------------
export interface AiSuccessRateCardProps {
    runs: Array<{ status: string }>;
}

export function AiSuccessRateCard({ runs }: AiSuccessRateCardProps) {
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const denominator = completed + failed;
    const rate = denominator === 0 ? 0 : Math.round((completed / denominator) * 100);

    // Arc parameters
    const cx = 48;
    const cy = 48;
    const r = 36;
    const strokeW = 7;
    const circumference = 2 * Math.PI * r;
    const progressOffset = circumference - (rate / 100) * circumference;
    const trackColor = 'rgba(255,255,255,0.07)';
    const arcColor = rate >= 80 ? '#38c872' : rate >= 50 ? '#ff9800' : '#e33d4f';

    return (
        <Box
            sx={{
                bgcolor: CARD_BG,
                border: CARD_BORDER,
                borderRadius: CARD_RADIUS,
                p: CARD_PADDING,
            }}
        >
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Success rate
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontWeight: 600, mt: 0.5, mb: 1.5 }}>
                Completed vs failed runs
            </Typography>

            <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ flexShrink: 0, position: 'relative' }}>
                    <svg width={96} height={96} viewBox="0 0 96 96">
                        {/* track */}
                        <circle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={trackColor}
                            strokeWidth={strokeW}
                        />
                        {/* progress arc — starts at top (rotated -90deg) */}
                        <circle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={arcColor}
                            strokeWidth={strokeW}
                            strokeDasharray={circumference}
                            strokeDashoffset={progressOffset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={16} fontWeight={700} fill={TEXT_PRIMARY}>
                            {rate}%
                        </text>
                        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={8.5} fill={TEXT_SECONDARY}>
                            success
                        </text>
                    </svg>
                </Box>

                <Stack spacing={0.8}>
                    <Stack spacing={0.2}>
                        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>Completed</Typography>
                        <Typography variant="h6" sx={{ color: '#38c872', fontWeight: 700, lineHeight: 1 }}>
                            {completed}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.2}>
                        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>Failed</Typography>
                        <Typography variant="h6" sx={{ color: '#e33d4f', fontWeight: 700, lineHeight: 1 }}>
                            {failed}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.2}>
                        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>Total tracked</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontWeight: 600, lineHeight: 1 }}>
                            {denominator}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );
}
