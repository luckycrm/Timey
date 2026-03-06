import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ModeEditOutlineOutlinedIcon from '@mui/icons-material/ModeEditOutlineOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import TurnedInNotOutlinedIcon from '@mui/icons-material/TurnedInNotOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../hooks/useAuth';
import { AppLogo } from '../common/AppLogo';

const SideItem = ({ icon: Icon, label, active = false, onClick }: any) => (
    <Tooltip title={label} placement="right" arrow>
        <IconButton
            onClick={onClick}
            sx={{
                borderRadius: 2,
                color: active ? '#ffffff' : '#858585',
                bgcolor: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                },
                width: 44,
                height: 44,
            }}
        >
            <Icon sx={{ fontSize: 22 }} />
        </IconButton>
    </Tooltip>
);

const WorkspaceNavItem = ({ icon: Icon, label, to = '/' }: any) => {
    const location = useLocation();
    const active = location.pathname === to;

    return (
        <Link
            to={to}
            style={{ textDecoration: 'none' }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    color: active ? '#ffffff' : '#858585',
                    bgcolor: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.04)',
                        color: '#ffffff',
                    },
                    transition: 'all 0.2s',
                }}
            >
                <Icon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {label}
                </Typography>
            </Box>
        </Link>
    );
};

interface DashboardLayoutProps {
    children: React.ReactNode;
    onLogout?: () => void;
    orgName?: string;
    chatSidebar?: React.ReactNode;
}

export function DashboardLayout({ children, onLogout, orgName = 'boats', chatSidebar }: DashboardLayoutProps) {
    const { email } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

    const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
    };

    const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#000000', color: '#ffffff', overflow: 'hidden' }}>
            {/* Global Sidebar (Narrow) */}
            <Box
                sx={{
                    width: 68,
                    borderRight: '1px solid #1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 2,
                    gap: 1.5,
                }}
            >
                <SideItem
                    icon={GridViewRoundedIcon}
                    label="Projects"
                    active={location.pathname === '/' || location.pathname.startsWith('/projects')}
                    onClick={() => navigate({ to: '/' })}
                />
                <SideItem
                    icon={ChatOutlinedIcon}
                    label="Chat"
                    active={location.pathname.startsWith('/chat')}
                    onClick={() => navigate({ to: '/chat' })}
                />
                <SideItem
                    icon={AutoAwesomeOutlinedIcon}
                    label="AI"
                    active={location.pathname.startsWith('/ai')}
                    onClick={() => navigate({ to: '/' } as any)}
                />
                <Box sx={{ mt: 'auto' }}>
                    <SideItem
                        icon={SettingsOutlinedIcon}
                        label="Settings"
                        active={location.pathname.startsWith('/settings')}
                        onClick={() => navigate({ to: '/' } as any)}
                    />
                </Box>
            </Box>

            {/* Workspace Sidebar */}
            <Box
                sx={{
                    width: 250,
                    borderRight: '1px solid #1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    bgcolor: '#000000'
                }}
            >
                {/* Workspace Switcher */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' },
                        mb: 2,
                    }}
                >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: 1,
                                bgcolor: '#0070f3',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}
                        >
                            {orgName.charAt(0)}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {orgName}
                        </Typography>
                    </Stack>
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: '#666' }} />
                </Box>

                {chatSidebar ? (
                    /* Chat sidebar content */
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {chatSidebar}
                    </Box>
                ) : (
                    /* Default workspace nav */
                    <>
                        {/* View Projects */}
                        <Link to="/" style={{ textDecoration: 'none' }}>
                            <Button
                                variant="outlined"
                                startIcon={<GridViewRoundedIcon />}
                                fullWidth
                                sx={{
                                    justifyContent: 'flex-start',
                                    color: '#ffffff',
                                    borderColor: '#222',
                                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    py: 1,
                                    mb: 3,
                                    '&:hover': {
                                        borderColor: '#333',
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    },
                                }}
                            >
                                View projects
                            </Button>
                        </Link>

                        {/* Main Nav */}
                        <Stack spacing={0.5} sx={{ mb: 4 }}>
                            <WorkspaceNavItem icon={HomeOutlinedIcon} label="Home" to="/" />
                            <WorkspaceNavItem icon={PeopleOutlineRoundedIcon} label="Members" to="/members" />
                            <WorkspaceNavItem icon={ModeEditOutlineOutlinedIcon} label="Drafts" to="/drafts" />
                            <WorkspaceNavItem icon={PersonOutlineOutlinedIcon} label="Your work" to="/work" />
                            <WorkspaceNavItem icon={TurnedInNotOutlinedIcon} label="Stickies" to="/stickies" />
                        </Stack>

                        {/* Workspace Groups */}
                        <Box>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#666',
                                    fontWeight: 600,
                                    px: 1.5,
                                    mb: 1.5,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Workspace
                            </Typography>
                            <Stack spacing={0.5}>
                                <WorkspaceNavItem icon={BlurOnRoundedIcon} label="More" />
                            </Stack>
                        </Box>
                    </>
                )}

                {/* Branding (Bottom) */}
                <Box sx={{ mt: 'auto', p: 1, display: 'flex', justifyContent: 'center' }}>
                    <AppLogo size="small" color="#ffffff" />
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header / TopBar Integration */}
                <Box
                    sx={{
                        height: 56,
                        borderBottom: '1px solid #1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 3,
                        bgcolor: '#000000'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ color: '#858585', fontWeight: 500 }}>
                            {orgName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#444' }}>/</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                                {location.pathname === '/' ? 'Home' : location.pathname.split('/')[1]?.charAt(0).toUpperCase() + location.pathname.split('/')[1]?.slice(1)}
                            </Typography>
                        </Stack>
                    </Box>

                    {/* Search */}
                    <Box
                        sx={{
                            flex: 0.5,
                            maxWidth: 400,
                            bgcolor: '#111',
                            borderRadius: 2,
                            px: 1.5,
                            py: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid #222',
                        }}
                    >
                        <SearchIcon sx={{ color: '#666', fontSize: 18, mr: 1 }} />
                        <InputBase
                            placeholder=""
                            fullWidth
                            sx={{
                                color: '#ffffff',
                                fontSize: '0.85rem',
                            }}
                        />
                    </Box>

                    {/* Actions */}
                    <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton size="small" sx={{ color: '#858585' }}>
                            <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                        <IconButton size="small" sx={{ color: '#858585' }}>
                            <HelpOutlineOutlinedIcon sx={{ fontSize: 20 }} />
                        </IconButton>

                        {/* User Profile & Menu */}
                        <Tooltip title="User Profile">
                            <IconButton
                                onClick={handleUserMenuOpen}
                                sx={{ ml: 1, p: 0.5, border: '1px solid #333' }}
                            >
                                <Avatar
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        bgcolor: '#2e7d32',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                    }}
                                >
                                    {email?.charAt(0).toUpperCase() || 'L'}
                                </Avatar>
                            </IconButton>
                        </Tooltip>

                        <Menu
                            anchorEl={userMenuAnchor}
                            open={Boolean(userMenuAnchor)}
                            onClose={handleUserMenuClose}
                            PaperProps={{
                                sx: {
                                    bgcolor: '#111',
                                    border: '1px solid #222',
                                    color: '#ffffff',
                                    minWidth: 180,
                                    mt: 1,
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.85rem',
                                        py: 1,
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' }
                                    }
                                }
                            }}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            <Box sx={{ px: 2, py: 1 }}>
                                <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                                    Signed in as
                                </Typography>
                                <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#fff' }}>
                                    {email}
                                </Typography>
                            </Box>
                            <Divider sx={{ borderColor: '#222' }} />
                            <MenuItem onClick={() => { handleUserMenuClose(); onLogout?.(); }}>
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: '#ff4d4d' }}>
                                    <LogoutRoundedIcon sx={{ fontSize: 18 }} />
                                    <Typography variant="inherit">Logout</Typography>
                                </Stack>
                            </MenuItem>
                        </Menu>
                    </Stack>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
