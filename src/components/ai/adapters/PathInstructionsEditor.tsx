import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { chatColors } from '../../../theme/chatColors';

interface PathInstructionsEditorProps {
    open: boolean;
    onClose: () => void;
    value: string;
    onSave: (value: string) => void;
    title?: string;
    description?: string;
}

export function PathInstructionsEditor({
    open,
    onClose,
    value,
    onSave,
    title = 'Edit agent instructions',
    description,
}: PathInstructionsEditorProps) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        if (open) setDraft(value);
    }, [open, value]);

    const handleSave = () => {
        onSave(draft);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: chatColors.panelBg,
                    border: `1px solid ${chatColors.border}`,
                    borderRadius: 2,
                },
            }}
        >
            <DialogTitle sx={{ color: chatColors.textPrimary, pb: 1 }}>
                {title}
            </DialogTitle>
            <DialogContent>
                <Typography
                    variant="body2"
                    sx={{ color: chatColors.textSecondary, mb: 2, lineHeight: 1.65 }}
                >
                    {description ?? 'Write or paste the system prompt / instructions that will be injected into this agent\'s context at runtime. Supports Markdown.'}
                </Typography>
                <TextField
                    fullWidth
                    multiline
                    minRows={12}
                    maxRows={28}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={'# Agent Instructions\n\nYou are a helpful assistant that...'}
                    sx={{
                        '& .MuiInputBase-root': {
                            bgcolor: 'rgba(255,255,255,0.04)',
                            fontFamily: 'monospace',
                            fontSize: 13,
                        },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: chatColors.border },
                    }}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{ textTransform: 'none', color: chatColors.textSecondary }}
                >
                    Cancel
                </Button>
                <Button variant="contained" onClick={handleSave} sx={{ textTransform: 'none' }}>
                    Save instructions
                </Button>
            </DialogActions>
        </Dialog>
    );
}
