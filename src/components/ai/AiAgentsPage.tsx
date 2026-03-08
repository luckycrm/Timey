import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { AIPageIntro, AIProgressRow, AISectionCard, AISectionGrid, AIStatCard, AIStatGrid, AIStatusPill, AIWorkspacePage } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';
import { NONE_U64, parseJsonList } from './aiUtils';

const agentStatusOptions = ['draft', 'active', 'paused', 'attention'] as const;
const autonomyOptions = ['manual', 'guarded', 'autonomous'] as const;
const approvalOptions = ['manual', 'threshold', 'auto'] as const;

export function AIAgentsPage() {
    const {
        currentOrgId,
        currentUser,
        aiAgents,
        aiAgentRuntimeByAgentId,
        aiProjects,
        aiWakeupRequests,
        usersById,
    } = useAIWorkspaceData();

    const createAiAgent = useReducer(reducers.createAiAgent);
    const updateAiAgentStatus = useReducer(reducers.updateAiAgentStatus);

    const [form, setForm] = useState({
        name: '',
        role: '',
        department: 'Operations',
        description: '',
        status: 'draft',
        autonomyMode: 'guarded',
        approvalMode: 'manual',
        projectId: '0',
        managerUserId: '0',
        dailyBudgetUsd: '25',
        tools: 'web_research,email_draft,proposal_outline',
    });
    const [submitting, setSubmitting] = useState(false);

    const activeAgents = aiAgents.filter((agent) => agent.status === 'active');
    const pausedAgents = aiAgents.filter((agent) => agent.status === 'paused' || agent.status === 'draft');
    const attentionAgents = aiAgents.filter((agent) => agent.status === 'attention');
    const agentsWithRuntime = aiAgents.filter((agent) => aiAgentRuntimeByAgentId.has(agent.id));
    const openWakeups = aiWakeupRequests.filter((wakeup) => ['queued', 'claimed', 'running'].includes(wakeup.status));

    const departments = useMemo(
        () => Array.from(new Set(aiAgents.map((agent) => agent.department).filter(Boolean))),
        [aiAgents]
    );

    const budgetAverage = aiAgents.length === 0
        ? 0
        : aiAgents.reduce((total, agent) => total + Number(agent.dailyBudgetMicrousd), 0) / aiAgents.length / 1_000_000;

    const readiness = useMemo(() => {
        const total = aiAgents.length || 1;
        const withProjects = aiAgents.filter((agent) => agent.projectId !== NONE_U64).length;
        const guardedOrManual = aiAgents.filter(
            (agent) => agent.autonomyMode === 'guarded' || agent.autonomyMode === 'manual'
        ).length;
        const withTools = aiAgents.filter((agent) => parseJsonList(agent.toolsJson).length > 0).length;
        return {
            staffing: Math.round((withProjects / total) * 100),
            governance: Math.round((guardedOrManual / total) * 100),
            tooling: Math.round((withTools / total) * 100),
        };
    }, [aiAgents]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (currentOrgId == null) return;

        try {
            setSubmitting(true);
            await createAiAgent({
                orgId: currentOrgId,
                projectId: BigInt(form.projectId),
                managerUserId: BigInt(form.managerUserId),
                name: form.name.trim(),
                role: form.role.trim(),
                department: form.department.trim(),
                description: form.description.trim(),
                status: form.status,
                autonomyMode: form.autonomyMode,
                approvalMode: form.approvalMode,
                toolsJson: JSON.stringify(
                    form.tools
                        .split(',')
                        .map((tool) => tool.trim())
                        .filter(Boolean)
                ),
                scheduleJson: JSON.stringify({ cadence: 'manual' }),
                dailyBudgetMicrousd: BigInt(Math.max(0, Math.round(Number(form.dailyBudgetUsd || '0') * 1_000_000))),
            });
            setForm({
                name: '',
                role: '',
                department: form.department,
                description: '',
                status: 'draft',
                autonomyMode: 'guarded',
                approvalMode: 'manual',
                projectId: '0',
                managerUserId: '0',
                dailyBudgetUsd: '25',
                tools: 'web_research,email_draft,proposal_outline',
            });
            toast.success('AI agent created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create AI agent');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AIWorkspacePage page="agents">
            <AIPageIntro
                eyebrow="Agents"
                title="Staff the AI workspace"
                description="Agents are now org-scoped records. Use this page to create the roster, assign ownership, and see which agents still need real work attached."
            />

            <AIStatGrid>
                <AIStatCard label="Active" value={String(activeAgents.length)} caption="Ready to pick up work" tone="success" />
                <AIStatCard label="Paused" value={String(pausedAgents.length)} caption="Draft or intentionally paused" tone="neutral" />
                <AIStatCard label="Needs attention" value={String(attentionAgents.length)} caption="Marked for review" tone="warning" />
                <AIStatCard label="Average daily budget" value={`$${budgetAverage.toFixed(0)}`} caption="Across current agent roster" tone="info" />
                <AIStatCard label="Runtime attached" value={String(agentsWithRuntime.length)} caption={`${openWakeups.length} live wakeups across agents`} tone="neutral" />
            </AIStatGrid>

            <AISectionGrid>
                <AISectionCard
                    eyebrow="Roster"
                    title="Current agent lineup"
                    description="This is now backed by AI agent records instead of placeholder rows."
                >
                    <Stack spacing={1.2}>
                        {aiAgents.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#858585', lineHeight: 1.7 }}>
                                No agents exist yet. Create the first agent on the right to start staffing the workspace.
                            </Typography>
                        ) : aiAgents.map((agent) => {
                            const owner = usersById.get(agent.ownerUserId);
                            const project = aiProjects.find((row) => row.id === agent.projectId);
                            const runtime = aiAgentRuntimeByAgentId.get(agent.id) ?? null;
                            const liveWakeupCount = aiWakeupRequests.filter((wakeup) => wakeup.agentId === agent.id && ['queued', 'claimed', 'running'].includes(wakeup.status)).length;
                            return (
                                <Stack
                                    key={agent.id.toString()}
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={1.5}
                                    justifyContent="space-between"
                                    sx={{
                                        px: 1.6,
                                        py: 1.4,
                                        borderRadius: '14px',
                                        border: '1px solid #1a1a1a',
                                        bgcolor: 'rgba(255,255,255,0.015)',
                                    }}
                                >
                                    <Stack spacing={0.6}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                                            {agent.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#858585' }}>
                                            {agent.role} • {agent.department}
                                            {project ? ` • ${project.name}` : ' • Unassigned project'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            Owner {owner?.name || owner?.email || 'Unknown'} • {agent.approvalMode} approvals • {agent.autonomyMode} mode
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#666666' }}>
                                            Runtime {runtime?.adapterType || 'not attached'} • {runtime?.runtimeStatus || 'idle'} • {liveWakeupCount} live wakeup{liveWakeupCount === 1 ? '' : 's'}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            href={`/ai/agents/${agent.id.toString()}`}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Details
                                        </Button>
                                        <AIStatusPill
                                            label={agent.status}
                                            tone={
                                                agent.status === 'active'
                                                    ? 'success'
                                                    : agent.status === 'attention'
                                                      ? 'warning'
                                                      : 'neutral'
                                            }
                                        />
                                        {agent.status === 'active' ? (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                sx={{ textTransform: 'none' }}
                                                onClick={() => updateAiAgentStatus({ agentId: agent.id, status: 'paused' }).catch((error) => {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to pause agent');
                                                })}
                                            >
                                                Pause
                                            </Button>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                sx={{ textTransform: 'none' }}
                                                onClick={() => updateAiAgentStatus({ agentId: agent.id, status: 'active' }).catch((error) => {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to activate agent');
                                                })}
                                            >
                                                Activate
                                            </Button>
                                        )}
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Create"
                    title="Add a new agent"
                    description="Keep the first version simple: name, role, department, control mode, and a rough tool list."
                >
                    <Stack component="form" spacing={1.4} onSubmit={handleSubmit}>
                        <TextField
                            size="small"
                            label="Agent name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        />
                        <TextField
                            size="small"
                            label="Primary role"
                            value={form.role}
                            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                            placeholder="Proposal writer"
                        />
                        <TextField
                            size="small"
                            label="Department"
                            value={form.department}
                            onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                            placeholder="Operations"
                        />
                        <TextField
                            size="small"
                            label="Description"
                            multiline
                            minRows={3}
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder="Handles proposal drafts, updates, and internal revisions."
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Status"
                                value={form.status}
                                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                                sx={{ minWidth: 160 }}
                            >
                                {agentStatusOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Autonomy"
                                value={form.autonomyMode}
                                onChange={(event) => setForm((current) => ({ ...current, autonomyMode: event.target.value }))}
                                sx={{ minWidth: 160 }}
                            >
                                {autonomyOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Approvals"
                                value={form.approvalMode}
                                onChange={(event) => setForm((current) => ({ ...current, approvalMode: event.target.value }))}
                                sx={{ minWidth: 160 }}
                            >
                                {approvalOptions.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                            <TextField
                                select
                                size="small"
                                label="Project"
                                value={form.projectId}
                                onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
                                sx={{ minWidth: 180 }}
                            >
                                <MenuItem value="0">No project yet</MenuItem>
                                {aiProjects.map((project) => (
                                    <MenuItem key={project.id.toString()} value={project.id.toString()}>
                                        {project.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Manager"
                                value={form.managerUserId}
                                onChange={(event) => setForm((current) => ({ ...current, managerUserId: event.target.value }))}
                                sx={{ minWidth: 180 }}
                            >
                                <MenuItem value="0">No manager set</MenuItem>
                                {[...usersById.values()].map((user) => (
                                    <MenuItem key={user.id.toString()} value={user.id.toString()}>
                                        {user.name || user.email}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                label="Daily budget (USD)"
                                type="number"
                                value={form.dailyBudgetUsd}
                                onChange={(event) => setForm((current) => ({ ...current, dailyBudgetUsd: event.target.value }))}
                            />
                        </Stack>
                        <TextField
                            size="small"
                            label="Allowed tools"
                            value={form.tools}
                            onChange={(event) => setForm((current) => ({ ...current, tools: event.target.value }))}
                            placeholder="web_research,email_draft,proposal_outline"
                            helperText="Comma-separated tool ids for the first version."
                        />
                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                Created by {currentUser?.name || currentUser?.email || 'current user'}
                            </Typography>
                            <Button type="submit" variant="contained" disabled={submitting || currentOrgId == null} sx={{ textTransform: 'none' }}>
                                {submitting ? 'Creating...' : 'Create agent'}
                            </Button>
                        </Stack>
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Readiness"
                    title="Coverage by lane"
                    description="This now reads from the actual roster instead of placeholder percentages."
                >
                    <Stack spacing={1.6}>
                        <AIProgressRow label="Agents attached to a project" value={readiness.staffing} detail={`${aiAgents.filter((agent) => agent.projectId !== NONE_U64).length} assigned`} tone="info" />
                        <AIProgressRow label="Agents staying inside guardrails" value={readiness.governance} detail={`${aiAgents.filter((agent) => agent.autonomyMode !== 'autonomous').length} manual or guarded`} tone="warning" />
                        <AIProgressRow label="Agents with tool access defined" value={readiness.tooling} detail={`${aiAgents.filter((agent) => parseJsonList(agent.toolsJson).length > 0).length} tool packs`} tone="success" />
                    </Stack>
                </AISectionCard>

                <AISectionCard
                    eyebrow="Coverage"
                    title="Roster gaps"
                    description="These are the honest gaps visible from the current AI tables."
                >
                    <Stack spacing={1.1}>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {aiAgents.filter((agent) => agent.projectId === NONE_U64).length} agents have no project assigned yet.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {aiAgents.filter((agent) => parseJsonList(agent.toolsJson).length === 0).length} agents still need a tool allowlist.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Departments in use: {departments.length > 0 ? departments.join(', ') : 'No departments defined yet'}.
                        </Typography>
                    </Stack>
                </AISectionCard>
            </AISectionGrid>
        </AIWorkspacePage>
    );
}

export const AiAgentsPage = AIAgentsPage;
