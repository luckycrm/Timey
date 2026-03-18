import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AdapterType } from './AdapterTypes';
import { getAdapterDefinition } from './adapterRegistry';
import { chatColors } from '../../../theme/chatColors';

interface AdapterConfigFormProps {
    adapterType: AdapterType;
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
    onSave: () => void;
    saving?: boolean;
    disabled?: boolean;
}

function getStringValue(config: Record<string, unknown>, key: string, fallback = ''): string {
    const val = config[key];
    return val != null ? String(val) : fallback;
}

function getBoolValue(config: Record<string, unknown>, key: string, fallback = false): boolean {
    const val = config[key];
    if (typeof val === 'boolean') return val;
    return fallback;
}

function getNumberValue(config: Record<string, unknown>, key: string, fallback = 0): number {
    const val = config[key];
    if (typeof val === 'number') return val;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readGatewayToken(config: Record<string, unknown>): string {
    const headers = config['headers'];
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
        const h = headers as Record<string, unknown>;
        if (typeof h['x-openclaw-token'] === 'string') return h['x-openclaw-token'];
    }
    return '';
}

function writeGatewayToken(config: Record<string, unknown>, rawToken: string): Record<string, unknown> {
    const existingHeaders =
        config['headers'] && typeof config['headers'] === 'object' && !Array.isArray(config['headers'])
            ? { ...(config['headers'] as Record<string, unknown>) }
            : {};
    const trimmed = rawToken.trim();
    if (trimmed) {
        existingHeaders['x-openclaw-token'] = trimmed;
    } else {
        delete existingHeaders['x-openclaw-token'];
    }
    return { ...config, headers: Object.keys(existingHeaders).length > 0 ? existingHeaders : undefined };
}

function readScopes(config: Record<string, unknown>): string {
    const val = config['scopes'];
    if (Array.isArray(val)) return val.filter((s): s is string => typeof s === 'string').join(', ');
    return typeof val === 'string' ? val : '';
}

function writeScopes(config: Record<string, unknown>, raw: string): Record<string, unknown> {
    const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return { ...config, scopes: parsed.length > 0 ? parsed : undefined };
}

function readArgs(config: Record<string, unknown>): string {
    const val = config['args'];
    if (Array.isArray(val)) return val.filter((s): s is string => typeof s === 'string').join(', ');
    return typeof val === 'string' ? val : '';
}

function writeArgs(config: Record<string, unknown>, raw: string): Record<string, unknown> {
    const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return { ...config, args: parsed.length > 0 ? parsed : undefined };
}

const fieldSx = {
    '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.04)' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: chatColors.border },
};

export function AdapterConfigForm({
    adapterType,
    config,
    onChange,
    onSave,
    saving = false,
    disabled = false,
}: AdapterConfigFormProps) {
    const definition = getAdapterDefinition(adapterType);
    const [showToken, setShowToken] = useState(false);

    const handleChange = (key: string, value: unknown) => {
        onChange({ ...config, [key]: value });
    };

    return (
        <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: chatColors.textSecondary, lineHeight: 1.65 }}>
                {definition.description}
            </Typography>

            <Divider sx={{ borderColor: chatColors.border }} />

            <Stack spacing={1.8}>
                {definition.fields.map((field) => {
                    if (field.key === '__gatewayToken') {
                        return (
                            <Box key={field.key}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    label={field.label}
                                    type={showToken ? 'text' : 'password'}
                                    value={readGatewayToken(config)}
                                    placeholder={field.placeholder}
                                    disabled={disabled || saving}
                                    onChange={(e) => onChange(writeGatewayToken(config, e.target.value))}
                                    InputProps={{
                                        endAdornment: (
                                            <Button
                                                size="small"
                                                sx={{ textTransform: 'none', minWidth: 48, color: chatColors.textSecondary }}
                                                onClick={() => setShowToken((v) => !v)}
                                            >
                                                {showToken ? 'Hide' : 'Show'}
                                            </Button>
                                        ),
                                    }}
                                    sx={fieldSx}
                                />
                                {field.description && (
                                    <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>
                                )}
                            </Box>
                        );
                    }

                    if (field.key === '__scopes') {
                        return (
                            <Box key={field.key}>
                                <TextField size="small" fullWidth label={field.label} value={readScopes(config)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => onChange(writeScopes(config, e.target.value))} sx={fieldSx} />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.key === 'args') {
                        return (
                            <Box key={field.key}>
                                <TextField size="small" fullWidth label={field.label} value={readArgs(config)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => onChange(writeArgs(config, e.target.value))} sx={fieldSx} />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.type === 'boolean') {
                        return (
                            <Box key={field.key}>
                                <FormControlLabel
                                    control={<Switch size="small" checked={getBoolValue(config, field.key, typeof field.defaultValue === 'boolean' ? field.defaultValue : false)} disabled={disabled || saving} onChange={(e) => handleChange(field.key, e.target.checked)} />}
                                    label={<Typography variant="body2" sx={{ color: chatColors.textPrimary }}>{field.label}</Typography>}
                                />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0, mt: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.type === 'select') {
                        return (
                            <Box key={field.key}>
                                <TextField select size="small" fullWidth label={field.label} value={getStringValue(config, field.key, typeof field.defaultValue === 'string' ? field.defaultValue : '')} disabled={disabled || saving} onChange={(e) => handleChange(field.key, e.target.value)} sx={fieldSx}>
                                    {(field.options ?? []).map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.type === 'number') {
                        return (
                            <Box key={field.key}>
                                <TextField size="small" fullWidth type="number" label={field.label} value={getNumberValue(config, field.key, typeof field.defaultValue === 'number' ? field.defaultValue : 0)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => handleChange(field.key, Number(e.target.value))} sx={fieldSx} />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.type === 'password') {
                        return (
                            <Box key={field.key}>
                                <TextField size="small" fullWidth type="password" label={field.label} value={getStringValue(config, field.key)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => handleChange(field.key, e.target.value)} sx={fieldSx} />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    if (field.type === 'textarea') {
                        return (
                            <Box key={field.key}>
                                <TextField size="small" fullWidth multiline minRows={3} label={field.label} value={getStringValue(config, field.key)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => handleChange(field.key, e.target.value)} sx={fieldSx} />
                                {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                            </Box>
                        );
                    }

                    // Default: text
                    return (
                        <Box key={field.key}>
                            <TextField size="small" fullWidth label={field.label} value={getStringValue(config, field.key)} placeholder={field.placeholder} disabled={disabled || saving} onChange={(e) => handleChange(field.key, e.target.value || undefined)} sx={fieldSx} />
                            {field.description && <FormHelperText sx={{ color: chatColors.textMuted, mx: 0 }}>{field.description}</FormHelperText>}
                        </Box>
                    );
                })}
            </Stack>

            {definition.fields.length === 0 && (
                <Typography variant="body2" sx={{ color: chatColors.textSecondary }}>
                    No additional configuration fields for this adapter type.
                </Typography>
            )}

            <Stack direction="row" justifyContent="flex-end">
                <Button variant="contained" size="small" disabled={disabled || saving} onClick={onSave} sx={{ textTransform: 'none' }}>
                    {saving ? 'Saving…' : 'Save adapter config'}
                </Button>
            </Stack>
        </Stack>
    );
}
