import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useReducer } from 'spacetimedb/tanstack';
import { reducers } from '../../module_bindings';
import { AIWorkspacePage } from './AIPrimitives';
import { useAIWorkspaceData } from './useAIWorkspaceData';

interface SecretFormState {
    name: string;
    description: string;
    value: string;
}

const emptyForm: SecretFormState = { name: '', description: '', value: '' };

export function AiSecretsPage() {
    const { currentOrgId, aiSecrets } = useAIWorkspaceData();
    const createAiSecret = useReducer(reducers.createAiSecret);
    const updateAiSecret = useReducer(reducers.updateAiSecret);
    const deleteAiSecret = useReducer(reducers.deleteAiSecret);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<bigint | null>(null);
    const [form, setForm] = useState<SecretFormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<bigint | null>(null);

    const activeSecrets = aiSecrets.filter((s) => !s.isDeleted);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (secret: typeof activeSecrets[0]) => {
        setEditingId(secret.id);
        setForm({ name: secret.name, description: secret.description, value: '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || currentOrgId == null) return;
        setSaving(true);
        try {
            if (editingId != null) {
                await updateAiSecret({ secretId: editingId, name: form.name.trim(), description: form.description.trim(), valueEncrypted: form.value });
            } else {
                await createAiSecret({ orgId: currentOrgId, name: form.name.trim(), description: form.description.trim(), valueEncrypted: form.value });
            }
            setDialogOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: bigint) => {
        await deleteAiSecret({ secretId: id });
        setDeleteConfirmId(null);
    };

    const cellSx = { color: '#d5d5d5', borderColor: 'rgba(255,255,255,0.06)', py: 1.2 };

    return (
        <AIWorkspacePage page="secrets">
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Secrets</Typography>

            <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{
                    bgcolor: 'rgba(255,152,0,0.08)',
                    border: '1px solid rgba(255,152,0,0.25)',
                    color: '#ffc47b',
                    '& .MuiAlert-icon': { color: '#ffc47b' },
                }}
            >
                Secret values are write-only. Once saved, they cannot be viewed or exported.
            </Alert>

            <Stack direction="row" justifyContent="flex-end">
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={openCreate}
                    sx={{ textTransform: 'none' }}
                >
                    Add secret
                </Button>
            </Stack>

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'rgba(255,255,255,0.015)',
                }}
            >
                {activeSecrets.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                        <LockOutlinedIcon sx={{ fontSize: 36, color: '#444', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#666' }}>
                            No secrets yet. Add one to get started.
                        </Typography>
                    </Box>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Name</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Description</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Value</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700 }}>Created</TableCell>
                                <TableCell sx={{ ...cellSx, color: '#858585', fontWeight: 700, width: 80 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {activeSecrets.map((secret) => (
                                <TableRow key={secret.id.toString()} hover>
                                    <TableCell sx={cellSx}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <LockOutlinedIcon sx={{ fontSize: 14, color: '#666' }} />
                                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>{secret.name}</Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="body2" sx={{ color: '#858585' }}>{secret.description || '—'}</Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="body2" sx={{ color: '#555', fontFamily: 'monospace' }}>••••••••</Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Typography variant="caption" sx={{ color: '#666' }}>
                                            {new Date(Number(secret.createdAt.microsSinceUnixEpoch / 1000n)).toLocaleDateString()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Stack direction="row" spacing={0.5}>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(secret)} sx={{ color: '#666', '&:hover': { color: '#b9d1ff' } }}>
                                                    <EditOutlinedIcon sx={{ fontSize: 15 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => setDeleteConfirmId(secret.id)} sx={{ color: '#666', '&:hover': { color: '#f5a3ad' } }}>
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
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}
            >
                <DialogTitle sx={{ color: '#ffffff' }}>
                    {editingId != null ? 'Edit secret' : 'Add secret'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        <TextField
                            size="small"
                            label="Name"
                            required
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. OPENAI_API_KEY"
                            fullWidth
                        />
                        <TextField
                            size="small"
                            label="Description"
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Optional description"
                            fullWidth
                        />
                        <TextField
                            size="small"
                            label={editingId != null ? 'New value (leave blank to keep current)' : 'Value'}
                            type="password"
                            value={form.value}
                            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                            placeholder="••••••••"
                            fullWidth
                            required={editingId == null}
                        />
                        {editingId != null && (
                            <Typography variant="caption" sx={{ color: '#858585' }}>
                                Leave the value field blank to keep the existing encrypted value.
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" disabled={saving || !form.name.trim()} onClick={handleSave} sx={{ textTransform: 'none' }}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog
                open={deleteConfirmId != null}
                onClose={() => setDeleteConfirmId(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}
            >
                <DialogTitle sx={{ color: '#ffffff' }}>Delete secret?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: '#d5d5d5' }}>
                        This will permanently delete the secret. Any agents relying on it will stop working.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setDeleteConfirmId(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={() => { if (deleteConfirmId != null) handleDelete(deleteConfirmId); }} sx={{ textTransform: 'none' }}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AIWorkspacePage>
    );
}
