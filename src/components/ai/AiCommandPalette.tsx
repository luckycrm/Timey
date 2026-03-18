import { useState, useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import type { AiAgent, AiGoal, AiProject, AiTask } from '../../module_bindings/types';

export interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    agents: AiAgent[];
    tasks: AiTask[];
    goals: AiGoal[];
    projects: AiProject[];
    onNavigate: (path: string) => void;
}

interface CommandResult {
    id: string;
    group: string;
    label: string;
    subtitle?: string;
    icon: React.ReactNode;
    path: string;
}

export function AiCommandPalette({ open, onClose, agents, tasks, goals, projects, onNavigate }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (!open) { setQuery(''); setSelectedIndex(0); } }, [open]);
    useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);

    const results = useMemo<CommandResult[]>(() => {
        const q = query.trim().toLowerCase();
        const matches: CommandResult[] = [];
        agents.filter((a) => !q || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)).slice(0, 5)
            .forEach((a) => matches.push({ id: `agent-${a.id}`, group: 'Agents', label: a.name, subtitle: a.role, icon: <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />, path: `/ai/agents/${a.id.toString()}` }));
        tasks.filter((t) => !q || t.title.toLowerCase().includes(q)).slice(0, 5)
            .forEach((t) => matches.push({ id: `task-${t.id}`, group: 'Tasks', label: t.title, subtitle: t.status, icon: <ChecklistRoundedIcon sx={{ fontSize: 16 }} />, path: `/ai/tasks/${t.id.toString()}` }));
        goals.filter((g) => !q || g.title.toLowerCase().includes(q)).slice(0, 5)
            .forEach((g) => matches.push({ id: `goal-${g.id}`, group: 'Goals', label: g.title, subtitle: g.status, icon: <FlagOutlinedIcon sx={{ fontSize: 16 }} />, path: `/ai/goals/${g.id.toString()}` }));
        projects.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 5)
            .forEach((p) => matches.push({ id: `project-${p.id}`, group: 'Projects', label: p.name, subtitle: p.status, icon: <FolderOpenOutlinedIcon sx={{ fontSize: 16 }} />, path: `/ai/projects/${p.id.toString()}` }));
        return matches;
    }, [query, agents, tasks, goals, projects]);

    const groups = useMemo(() => {
        const map = new Map<string, CommandResult[]>();
        for (const r of results) { if (!map.has(r.group)) map.set(r.group, []); map.get(r.group)!.push(r); }
        return Array.from(map.entries());
    }, [results]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); const r = results[selectedIndex]; if (r) { onNavigate(r.path); onClose(); } }
        else if (e.key === 'Escape') { onClose(); }
    };

    let globalIndex = 0;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
            PaperProps={{ sx: { bgcolor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' } }}>
            <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <TextField
                    inputRef={inputRef} fullWidth size="small"
                    placeholder="Search agents, tasks, goals, projects..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
                    sx={{
                        '& .MuiOutlinedInput-root': { bgcolor: 'transparent', '& fieldset': { border: 'none' } },
                        '& input': { color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' },
                        '& input::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 },
                    }}
                />
            </Box>
            <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {results.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)' }}>No results found.</Typography>
                    </Box>
                ) : groups.map(([groupLabel, groupResults], gi) => (
                    <Box key={groupLabel}>
                        {gi > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                        <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1.5, pb: 0.5, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>
                            {groupLabel}
                        </Typography>
                        <List dense disablePadding>
                            {groupResults.map((result) => {
                                const idx = globalIndex++;
                                const isSelected = idx === selectedIndex;
                                return (
                                    <ListItemButton key={result.id} selected={isSelected}
                                        onClick={() => { onNavigate(result.path); onClose(); }}
                                        sx={{ px: 2, py: 0.9, '&.Mui-selected': { bgcolor: 'rgba(126,176,255,0.12)', '&:hover': { bgcolor: 'rgba(126,176,255,0.16)' } }, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                                        <ListItemIcon sx={{ minWidth: 32, color: 'rgba(255,255,255,0.4)' }}>{result.icon}</ListItemIcon>
                                        <ListItemText
                                            primary={result.label} secondary={result.subtitle}
                                            primaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', fontWeight: 500 } }}
                                            secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' } }}
                                        />
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>
                ))}
            </Box>
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>
                    ↑↓ navigate · Enter select · Esc close
                </Typography>
            </Box>
        </Dialog>
    );
}
