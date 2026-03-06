import IconButton from '@mui/material/IconButton';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeMode } from '../../theme/ThemeContext';

export function ThemeToggle() {
    const { mode, toggleTheme } = useThemeMode();

    return (
        <IconButton
            onClick={toggleTheme}
            id="theme-toggle"
            aria-label="Toggle theme"
            sx={{
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                width: 46,
                height: 46,
                boxShadow: '0 8px 18px rgba(0, 0, 0, 0.06)',
            }}
        >
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
    );
}
