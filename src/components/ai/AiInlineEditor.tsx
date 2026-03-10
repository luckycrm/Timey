import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

export interface InlineEditorProps {
    value: string;
    onSave: (value: string) => void;
    multiline?: boolean;
    placeholder?: string;
    variant?: 'title' | 'body';
    disabled?: boolean;
}

export function AiInlineEditor({
    value,
    onSave,
    multiline = false,
    placeholder = 'Click to edit...',
    variant = 'body',
    disabled = false,
}: InlineEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [hovered, setHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => { setDraft(value); }, [value]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
        }
    }, [editing]);

    const commit = useCallback(() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onSave(trimmed);
        else setDraft(value);
        setEditing(false);
    }, [draft, value, onSave]);

    const cancel = useCallback(() => { setDraft(value); setEditing(false); }, [value]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { cancel(); return; }
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); return; }
        if (e.key === 'Enter' && multiline && e.shiftKey) { e.preventDefault(); commit(); return; }
    }, [multiline, commit, cancel]);

    if (editing) {
        return (
            <ClickAwayListener onClickAway={commit}>
                <TextField
                    inputRef={inputRef}
                    fullWidth size="small"
                    multiline={multiline}
                    minRows={multiline ? 3 : undefined}
                    value={draft}
                    placeholder={placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.04)',
                            '& fieldset': { borderColor: 'rgba(126,176,255,0.4)' },
                            '&.Mui-focused fieldset': { borderColor: 'rgba(126,176,255,0.7)' },
                        },
                        '& input, & textarea': {
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: variant === 'title' ? '1.1rem' : '0.875rem',
                            fontWeight: variant === 'title' ? 700 : 400,
                        },
                    }}
                    helperText={multiline ? 'Shift+Enter to save, Esc to cancel' : 'Enter to save, Esc to cancel'}
                    FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', mt: 0.5 } }}
                />
            </ClickAwayListener>
        );
    }

    const isEmpty = !value || value.trim() === '';

    return (
        <Box
            onMouseEnter={() => !disabled && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => !disabled && setEditing(true)}
            sx={{
                display: 'flex', alignItems: 'flex-start', gap: 0.75,
                cursor: disabled ? 'default' : 'pointer',
                borderRadius: '6px', px: 0.5, py: 0.35, mx: -0.5,
                transition: 'background 0.15s ease',
                bgcolor: hovered && !disabled ? 'rgba(255,255,255,0.04)' : 'transparent',
            }}
        >
            <Typography
                variant={variant === 'title' ? 'h6' : 'body2'}
                sx={{
                    color: isEmpty ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.9)',
                    fontStyle: isEmpty ? 'italic' : 'normal',
                    fontWeight: variant === 'title' ? 700 : 400,
                    lineHeight: 1.6, flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                }}
            >
                {isEmpty ? placeholder : value}
            </Typography>
            {hovered && !disabled && (
                <IconButton
                    size="small"
                    sx={{ p: 0.35, color: 'rgba(255,255,255,0.3)', flexShrink: 0, mt: 0.1,
                        '&:hover': { color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.06)' } }}
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                >
                    <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            )}
        </Box>
    );
}
