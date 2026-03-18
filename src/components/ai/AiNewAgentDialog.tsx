import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import { reducers } from '../../module_bindings';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const ADAPTER_OPTIONS = [
    { value: 'claude_local', label: 'Claude Code', description: 'Local Claude agent via claude-code CLI' },
    { value: 'opencode_local', label: 'OpenCode', description: 'Local multi-provider agent' },
    { value: 'openclaw_gateway', label: 'OpenClaw Gateway', description: 'Invoke OpenClaw via gateway protocol' },
    { value: 'http', label: 'HTTP Adapter', description: 'Generic HTTP-based agent adapter' },
    { value: 'process', label: 'Process Adapter', description: 'Spawns a local process as agent' },
    { value: 'cursor', label: 'Cursor', description: 'Local Cursor agent' },
    { value: 'codex_local', label: 'Codex', description: 'Local Codex agent' },
] as const;

type AdapterValue = (typeof ADAPTER_OPTIONS)[number]['value'];

const STEPS = ['Basic Info', 'Adapter Type', 'Review'];

interface AiNewAgentDialogProps {
    open: boolean;
    onClose: () => void;
}

const defaultForm = {
    name: '', role: '', department: 'Engineering', description: '',
    adapterType: 'claude_local' as AdapterValue,
    projectId: '0', managerUserId: '0',
    autonomyMode: 'guarded', approvalMode: 'manual', dailyBudgetUsd: '25',
};

export function AiNewAgentDialog({ open, onClose }: AiNewAgentDialogProps) {
    const { currentOrgId, aiProjects, usersById } = useAIWorkspaceData();
    const createAiAgent = useReducer(reducers.createAiAgent);
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(defaultForm);

    const handleClose = () => { setStep(0); setForm(defaultForm); onClose(); };

    const handleSubmit = async () => {
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
                status: 'draft',
                autonomyMode: form.autonomyMode,
                approvalMode: form.approvalMode,
                toolsJson: JSON.stringify([]),
                scheduleJson: JSON.stringify({ cadence: 'manual' }),
                dailyBudgetMicrousd: BigInt(Math.max(0, Math.round(Number(form.dailyBudgetUsd || '0') * 1_000_000))),
            });
            toast.success('Agent created');
            handleClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create agent');
        } finally {
            setSubmitting(false);
        }
    };

    const canProceed0 = form.name.trim().length > 0 && form.role.trim().length > 0;
    const selectedAdapter = ADAPTER_OPTIONS.find((a) => a.value === form.adapterType);

    const stepperSx = {
        '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' },
        '& .MuiStepLabel-label.Mui-active': { color: '#b9d1ff' },
        '& .MuiStepLabel-label.Mui-completed': { color: '#9de0b6' },
        '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.12)' },
        '& .MuiStepIcon-root.Mui-active': { color: '#7eb0ff' },
        '& .MuiStepIcon-root.Mui-completed': { color: '#38c872' },
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm"
            PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' } }}>
            <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <SmartToyOutlinedIcon sx={{ color: '#7eb0ff', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>New Agent</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
                <Stepper activeStep={step} sx={{ mb: 3 }}>
                    {STEPS.map((label) => <Step key={label}><StepLabel sx={stepperSx}>{label}</StepLabel></Step>)}
                </Stepper>

                {step === 0 && (
                    <Stack spacing={1.8}>
                        <TextField size="small" label="Agent name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Proposal Writer" autoFocus />
                        <TextField size="small" label="Primary role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="e.g. Handles proposal drafts" />
                        <TextField size="small" label="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                        <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this agent does..." />
                        <Stack direction="row" spacing={1.2}>
                            <TextField select size="small" label="Project" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} sx={{ flex: 1 }}>
                                <MenuItem value="0">No project yet</MenuItem>
                                {aiProjects.map((p) => <MenuItem key={p.id.toString()} value={p.id.toString()}>{p.name}</MenuItem>)}
                            </TextField>
                            <TextField select size="small" label="Manager" value={form.managerUserId} onChange={(e) => setForm((f) => ({ ...f, managerUserId: e.target.value }))} sx={{ flex: 1 }}>
                                <MenuItem value="0">No manager</MenuItem>
                                {[...usersById.values()].map((u) => <MenuItem key={u.id.toString()} value={u.id.toString()}>{u.name || u.email}</MenuItem>)}
                            </TextField>
                        </Stack>
                        <Stack direction="row" spacing={1.2}>
                            <TextField select size="small" label="Autonomy" value={form.autonomyMode} onChange={(e) => setForm((f) => ({ ...f, autonomyMode: e.target.value }))} sx={{ flex: 1 }}>
                                {['manual', 'guarded', 'autonomous'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                            </TextField>
                            <TextField select size="small" label="Approvals" value={form.approvalMode} onChange={(e) => setForm((f) => ({ ...f, approvalMode: e.target.value }))} sx={{ flex: 1 }}>
                                {['manual', 'threshold', 'auto'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                            </TextField>
                            <TextField size="small" label="Daily budget ($)" type="number" value={form.dailyBudgetUsd} onChange={(e) => setForm((f) => ({ ...f, dailyBudgetUsd: e.target.value }))} sx={{ flex: 1 }} />
                        </Stack>
                    </Stack>
                )}

                {step === 1 && (
                    <Stack spacing={1}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>Choose how this agent will run:</Typography>
                        {ADAPTER_OPTIONS.map((adapter) => {
                            const isSelected = form.adapterType === adapter.value;
                            return (
                                <Box key={adapter.value} onClick={() => setForm((f) => ({ ...f, adapterType: adapter.value }))}
                                    sx={{
                                        px: 2, py: 1.4, borderRadius: '10px', cursor: 'pointer',
                                        border: `1px solid ${isSelected ? 'rgba(126,176,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                                        bgcolor: isSelected ? 'rgba(126,176,255,0.1)' : 'rgba(255,255,255,0.02)',
                                        transition: 'all 0.15s ease',
                                        '&:hover': { borderColor: isSelected ? 'rgba(126,176,255,0.55)' : 'rgba(255,255,255,0.15)' },
                                    }}>
                                    <Typography variant="body2" sx={{ color: isSelected ? '#b9d1ff' : 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.85rem' }}>{adapter.label}</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', display: 'block', mt: 0.25 }}>{adapter.description}</Typography>
                                </Box>
                            );
                        })}
                    </Stack>
                )}

                {step === 2 && (
                    <Stack spacing={1.4}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>Review before creating:</Typography>
                        {[
                            { label: 'Name', value: form.name }, { label: 'Role', value: form.role },
                            { label: 'Department', value: form.department }, { label: 'Adapter', value: selectedAdapter?.label ?? form.adapterType },
                            { label: 'Autonomy', value: form.autonomyMode }, { label: 'Approvals', value: form.approvalMode },
                            { label: 'Daily budget', value: `$${form.dailyBudgetUsd}` },
                        ].map(({ label, value }) => (
                            <Stack key={label} direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{label}</Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Button variant="text" onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}
                    sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)' }}>
                    {step === 0 ? 'Cancel' : 'Back'}
                </Button>
                <Box sx={{ flex: 1 }} />
                {step < STEPS.length - 1 ? (
                    <Button variant="contained" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !canProceed0} sx={{ textTransform: 'none' }}>Next</Button>
                ) : (
                    <Button variant="contained" onClick={handleSubmit} disabled={submitting || currentOrgId == null} sx={{ textTransform: 'none' }}>
                        {submitting ? 'Creating...' : 'Create agent'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
