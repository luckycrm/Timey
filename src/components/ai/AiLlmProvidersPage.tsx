import { useState, useEffect, useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useReducer } from 'spacetimedb/tanstack';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const PROVIDER_TYPES = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'custom', label: 'Custom / OpenAI-compatible' },
];

interface ModelOption { id: string; label: string; }

interface LlmFormState {
    name: string;
    providerType: string;
    modelId: string;
    baseUrl: string;
    apiKeySecretId: string;
}

const emptyForm: LlmFormState = {
    name: '',
    providerType: 'anthropic',
    modelId: '',
    baseUrl: '',
    apiKeySecretId: '0',
};

export function AiLlmProvidersPage() {
    const { currentOrgId, aiLlmProviders: providers, aiSecrets } = useAIWorkspaceData();
    const secrets = aiSecrets.filter((s) => !s.isDeleted);
    const createAiLlmProvider = useReducer(reducers.createAiLlmProvider);
    const updateAiLlmProvider = useReducer(reducers.updateAiLlmProvider);
    const deleteAiLlmProvider = useReducer(reducers.deleteAiLlmProvider);
    const setDefaultAiLlmProvider = useReducer(reducers.setDefaultAiLlmProvider);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<bigint | null>(null);
    const [form, setForm] = useState<LlmFormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<bigint | null>(null);

    // Model fetch state
    const [fetchedModels, setFetchedModels] = useState<ModelOption[]>([]);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const fetchAbortRef = useRef<AbortController | null>(null);

    // Auto-fetch whenever provider type or selected secret changes (while dialog is open)
    useEffect(() => {
        if (!dialogOpen) return;

        const selectedSecret = secrets.find((s) => s.id.toString() === form.apiKeySecretId);
        const apiKey = selectedSecret?.valueEncrypted ?? undefined;

        // OpenRouter works without a key; others need one
        const canFetch = form.providerType === 'openrouter' || !!apiKey;
        if (!canFetch) {
            setFetchedModels([]);
            setFetchError(null);
            return;
        }

        fetchAbortRef.current?.abort();
        const ctrl = new AbortController();
        fetchAbortRef.current = ctrl;

        setFetchLoading(true);
        setFetchError(null);
        setFetchedModels([]);

        fetch(`${API_BASE}/api/llm/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                providerType: form.providerType,
                apiKey,
                baseUrl: form.baseUrl || undefined,
            }),
            signal: ctrl.signal,
        })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
                return json.models as ModelOption[];
            })
            .then((models) => {
                setFetchedModels(models);
                setFetchError(null);
            })
            .catch((e) => {
                if (e.name === 'AbortError') return;
                setFetchError(e.message ?? 'Failed to fetch models');
            })
            .finally(() => setFetchLoading(false));

        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogOpen, form.providerType, form.apiKeySecretId, form.baseUrl]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFetchedModels([]);
        setFetchError(null);
        setDialogOpen(true);
    };

    const openEdit = (p: typeof providers[0]) => {
        setEditingId(p.id);
        setForm({ name: p.name, providerType: p.providerType, modelId: p.modelId, baseUrl: p.baseUrl, apiKeySecretId: '0' });
        setFetchedModels([]);
        setFetchError(null);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || currentOrgId == null) return;
        setSaving(true);
        try {
            if (editingId != null) {
                await updateAiLlmProvider({ providerId: editingId, name: form.name.trim(), baseUrl: form.baseUrl.trim(), modelId: form.modelId.trim(), isDefault: false });
            } else {
                await createAiLlmProvider({ orgId: currentOrgId, name: form.name.trim(), providerType: form.providerType, baseUrl: form.baseUrl.trim(), modelId: form.modelId.trim(), apiKeySecretId: BigInt(form.apiKeySecretId) });
            }
            setDialogOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (id: bigint) => {
        if (currentOrgId == null) return;
        await setDefaultAiLlmProvider({ orgId: currentOrgId, providerId: id });
    };

    const handleDelete = async (id: bigint) => {
        await deleteAiLlmProvider({ providerId: id });
        setDeleteConfirmId(null);
    };

    const selectedModel = fetchedModels.find((m) => m.id === form.modelId) ?? null;
    const cellSx = { color: '#d5d5d5', borderColor: 'rgba(255,255,255,0.06)', py: 1.2 };

    return (
        <AIWorkspacePage page="llms">
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>LLM Providers</Typography>

            <Stack direction="row" justifyContent="flex-end">
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none' }}>
                    Add provider
                </Button>
            </Stack>

            <Paper elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.015)' }}>
                {providers.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                        <SmartToyOutlinedIcon sx={{ fontSize: 36, color: '#444', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#666' }}>No LLM providers configured.</Typography>
                    </Box>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Name</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Provider</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Model</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Base URL</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Default</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700, width: 100 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {providers.map((p) => (
                                <TableRow key={p.id.toString()} hover>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>{p.name}</Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Chip size="small" label={p.providerType} sx={{ bgcolor: 'rgba(116,167,255,0.12)', color: '#b9d1ff', fontSize: '0.7rem' }} />
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="body2" sx={{ color: '#d5d5d5', fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.modelId || '—'}</Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="caption" sx={{ color: '#666' }}>{p.baseUrl || 'Default'}</Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Tooltip title={p.isDefault ? 'Default provider' : 'Set as default'}>
                                            <IconButton size="small" onClick={() => !p.isDefault && handleSetDefault(p.id)} sx={{ color: p.isDefault ? '#ffc107' : '#555', '&:hover': { color: '#ffc107' } }}>
                                                {p.isDefault ? <StarIcon sx={{ fontSize: 16 }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Stack direction="row" spacing={0.5}>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(p)} sx={{ color: '#666', '&:hover': { color: '#b9d1ff' } }}>
                                                    <EditOutlinedIcon sx={{ fontSize: 15 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => setDeleteConfirmId(p.id)} sx={{ color: '#666', '&:hover': { color: '#f5a3ad' } }}>
                                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>

            {/* Add / Edit dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
                <DialogTitle sx={{ color: '#ffffff' }}>{editingId != null ? 'Edit provider' : 'Add LLM provider'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        <TextField size="small" label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Claude" fullWidth />

                        <TextField select size="small" label="Provider type" value={form.providerType} onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value, modelId: '' }))} fullWidth>
                            {PROVIDER_TYPES.map((pt) => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
                        </TextField>

                        <TextField size="small" label="Base URL (optional)" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder={
                            form.providerType === 'anthropic' ? 'https://api.anthropic.com' :
                            form.providerType === 'openai' ? 'https://api.openai.com' :
                            form.providerType === 'openrouter' ? 'https://openrouter.ai' :
                            'https://your-endpoint.com'
                        } fullWidth />

                        {secrets.length > 0 && (
                            <TextField select size="small" label="API key secret" value={form.apiKeySecretId} onChange={(e) => setForm((f) => ({ ...f, apiKeySecretId: e.target.value, modelId: '' }))} fullWidth>
                                <MenuItem value="0">— None —</MenuItem>
                                {secrets.map((s) => <MenuItem key={s.id.toString()} value={s.id.toString()}>{s.name}</MenuItem>)}
                            </TextField>
                        )}

                        {/* Model selector — auto-fetched from Elysia proxy */}
                        <Box>
                            {fetchLoading ? (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                                    <CircularProgress size={14} sx={{ color: '#7dd6cb' }} />
                                    <Typography variant="caption" sx={{ color: '#7dd6cb' }}>Fetching models…</Typography>
                                </Stack>
                            ) : fetchError ? (
                                <Stack spacing={1}>
                                    <Typography variant="caption" sx={{ color: '#f27474' }}>{fetchError}</Typography>
                                    <TextField size="small" label="Model ID" value={form.modelId} onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))} placeholder="Enter model ID manually" fullWidth />
                                </Stack>
                            ) : fetchedModels.length > 0 ? (
                                <Autocomplete
                                    size="small"
                                    options={fetchedModels}
                                    getOptionLabel={(o) => o.label}
                                    value={selectedModel}
                                    onChange={(_e, v) => setForm((f) => ({ ...f, modelId: v?.id ?? '' }))}
                                    isOptionEqualToValue={(a, b) => a.id === b.id}
                                    renderInput={(params) => (
                                        <TextField {...params} label={`Model (${fetchedModels.length} available)`} placeholder="Search models…" />
                                    )}
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props} key={option.id}>
                                            <Stack>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{option.label}</Typography>
                                                {option.label !== option.id && (
                                                    <Typography variant="caption" sx={{ color: '#858585', fontFamily: 'monospace' }}>{option.id}</Typography>
                                                )}
                                            </Stack>
                                        </Box>
                                    )}
                                    fullWidth
                                />
                            ) : (
                                <TextField
                                    size="small"
                                    label="Model ID"
                                    value={form.modelId}
                                    onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                                    placeholder={form.providerType === 'openrouter' ? 'Fetching…' : 'Select an API key secret above to auto-load models'}
                                    fullWidth
                                    disabled={form.providerType === 'openrouter'}
                                />
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" disabled={saving || !form.name.trim()} onClick={handleSave} sx={{ textTransform: 'none' }}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={deleteConfirmId != null} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
                <DialogTitle sx={{ color: '#ffffff' }}>Delete provider?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: '#d5d5d5' }}>Agents configured to use this provider will need to be updated.</Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setDeleteConfirmId(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={() => deleteConfirmId != null && handleDelete(deleteConfirmId)} sx={{ textTransform: 'none' }}>Delete</Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}
