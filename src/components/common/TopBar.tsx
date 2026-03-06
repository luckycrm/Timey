import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import PublicIcon from '@mui/icons-material/Public';
import { AppLogo } from './AppLogo';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
    onLogout?: () => void;
    showLogout?: boolean;
}

export function TopBar({ onLogout, showLogout = true }: TopBarProps) {
    return (
        <Box
            sx={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                px: { xs: 2, sm: 3, lg: 4 },
                pt: 2,
            }}
        >
            <Paper
                sx={{
                    maxWidth: 1280,
                    mx: 'auto',
                    px: { xs: 2, sm: 2.5 },
                    py: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: '0 12px 30px rgba(18, 26, 29, 0.08)',
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                    <AppLogo size="small" />
                    <Stack spacing={0.15} sx={{ minWidth: 0, display: { xs: 'none', md: 'flex' } }}>
                        <Typography variant="caption" color="text.secondary">
                            Follow-the-sun workspace
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            Time, coverage, and handoff coordination in one surface
                        </Typography>
                    </Stack>
                    <Chip
                        size="small"
                        icon={<PublicIcon />}
                        label="Maincloud"
                        sx={{
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                            color: 'text.primary',
                            borderColor: 'divider',
                            display: { xs: 'none', sm: 'inline-flex' },
                        }}
                    />
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1}>
                    <ThemeToggle />
                    {showLogout && onLogout && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LogoutIcon />}
                            onClick={onLogout}
                            id="logout-btn"
                        >
                            Logout
                        </Button>
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}
