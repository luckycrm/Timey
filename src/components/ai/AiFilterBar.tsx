import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';

export interface FilterConfig {
    key: string;
    label: string;
    options: { value: string; label: string }[];
}

export interface FilterBarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    filters: FilterConfig[];
    activeFilters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    onClearAll: () => void;
}

export function AiFilterBar({
    searchValue,
    onSearchChange,
    filters,
    activeFilters,
    onFilterChange,
    onClearAll,
}: FilterBarProps) {
    const hasActiveFilters =
        searchValue.trim().length > 0 ||
        Object.values(activeFilters).some((v) => v !== '' && v !== 'all');

    const handleRemoveFilter = useCallback(
        (key: string) => { onFilterChange(key, 'all'); },
        [onFilterChange],
    );

    const activeChips = filters
        .filter((f) => activeFilters[f.key] && activeFilters[f.key] !== '' && activeFilters[f.key] !== 'all')
        .map((f) => {
            const option = f.options.find((o) => o.value === activeFilters[f.key]);
            return { key: f.key, label: f.label, valueLabel: option?.label ?? activeFilters[f.key] };
        });

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, py: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                <TextField
                    size="small"
                    placeholder="Search..."
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        minWidth: 220,
                        '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.035)',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&.Mui-focused fieldset': { borderColor: 'rgba(126,176,255,0.5)' },
                        },
                        '& input': { color: 'rgba(255,255,255,0.85)' },
                        '& input::placeholder': { color: 'rgba(255,255,255,0.35)', opacity: 1 },
                    }}
                />
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <FilterListIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', mt: 0.5 }} />
                    {filters.map((filter) => (
                        <FormControl key={filter.key} size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#7eb0ff' } }}>
                                {filter.label}
                            </InputLabel>
                            <Select
                                label={filter.label}
                                value={activeFilters[filter.key] ?? 'all'}
                                onChange={(e) => onFilterChange(filter.key, e.target.value as string)}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.035)',
                                    color: 'rgba(255,255,255,0.85)',
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(126,176,255,0.5)' },
                                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
                                }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                {filter.options.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ))}
                    {hasActiveFilters && (
                        <Button
                            size="small" variant="text"
                            startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
                            onClick={onClearAll}
                            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', px: 1,
                                '&:hover': { color: 'rgba(255,255,255,0.8)', bgcolor: 'rgba(255,255,255,0.05)' } }}
                        >
                            Clear all
                        </Button>
                    )}
                </Stack>
            </Stack>
            {activeChips.length > 0 && (
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    {activeChips.map((chip) => (
                        <Chip
                            key={chip.key} size="small"
                            label={`${chip.label}: ${chip.valueLabel}`}
                            onDelete={() => handleRemoveFilter(chip.key)}
                            deleteIcon={<ClearIcon sx={{ fontSize: 12 }} />}
                            sx={{
                                bgcolor: 'rgba(126,176,255,0.12)', color: '#b9d1ff',
                                border: '1px solid rgba(126,176,255,0.25)', borderRadius: '6px',
                                fontSize: '0.72rem', height: 24,
                                '& .MuiChip-deleteIcon': { color: 'rgba(185,209,255,0.55)', '&:hover': { color: '#b9d1ff' } },
                            }}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
