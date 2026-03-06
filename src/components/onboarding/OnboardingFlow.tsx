import { useEffect, useState } from 'react';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import { useNavigate } from '@tanstack/react-router';
import { useReducer } from 'spacetimedb/tanstack';
import { reducers } from '../../module_bindings';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { AppLogo } from '../common/AppLogo';
import { toast } from 'sonner';

const setupPaths = [
    {
        id: 'create' as const,
        title: 'Create a new workspace',
        description: 'Start the home base for your team.',
        icon: <AddBusinessRoundedIcon />,
    },
    {
        id: 'join' as const,
        title: 'Join an existing workspace',
        description: 'Join a shared operating flow.',
        icon: <KeyRoundedIcon />,
    },
];

export default function OnboardingFlow() {
    const navigate = useNavigate();
    const { isAuthenticated, email, isLoading: authLoading, logout } = useAuth();
    const { hasOrganization, isCheckingMembership } = useOrganizationMembership({
        enabled: isAuthenticated,
    });

    const createOrganization = useReducer(reducers.createOrganization);
    const joinOrganization = useReducer(reducers.joinOrganization);

    const [action, setAction] = useState<'create' | 'join'>('create');
    const [orgName, setOrgName] = useState('');
    const [orgId, setOrgId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate({ to: '/login' });
        }
    }, [authLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && !isCheckingMembership && hasOrganization) {
            navigate({ to: '/' });
        }
    }, [authLoading, hasOrganization, isAuthenticated, isCheckingMembership, navigate]);

    if (authLoading || (isAuthenticated && isCheckingMembership)) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={32} thickness={4} sx={{ color: 'text.secondary', opacity: 0.5 }} />
            </Box>
        );
    }

    if (!isAuthenticated || !email || hasOrganization) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (action === 'create') {
                if (!orgName.trim()) throw new Error('Workspace name is required');
                await createOrganization({ name: orgName.trim() });
                toast.success(`Workspace "${orgName.trim()}" created!`);
            } else {
                if (!orgId.trim()) throw new Error('Workspace ID is required');
                await joinOrganization({ token: orgId.trim() });
                toast.success('Joined workspace successfully!');
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#ffffff', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
                <Button
                    onClick={() => logout()}
                    sx={{
                        color: '#858585',
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                        '&:hover': { color: '#ffffff', bgcolor: 'transparent' }
                    }}
                >
                    Logout
                </Button>
            </Box>
            <Container maxWidth="xs" sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 8 }}>
                <Stack spacing={4} alignItems="center">
                    <Box sx={{ mb: 1 }}>
                        <AppLogo color="#ffffff" />
                    </Box>

                    <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                letterSpacing: '-0.02em',
                                color: '#ffffff'
                            }}
                        >
                            Welcome to Timey
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#858585' }}>
                            Signed in as {email}.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.5} sx={{ width: '100%' }}>
                        {setupPaths.map((path) => {
                            const selected = action === path.id;
                            return (
                                <Box
                                    key={path.id}
                                    component="button"
                                    type="button"
                                    onClick={() => setAction(path.id)}
                                    sx={{
                                        textAlign: 'left',
                                        width: '100%',
                                        border: '1px solid',
                                        borderColor: selected ? '#ffffff' : '#333333',
                                        borderRadius: 2,
                                        p: 2,
                                        bgcolor: selected ? '#111111' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            borderColor: selected ? '#ffffff' : '#444444',
                                            bgcolor: selected ? '#111111' : 'rgba(255, 255, 255, 0.02)',
                                        },
                                    }}
                                >
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 1.5,
                                                display: 'grid',
                                                placeItems: 'center',
                                                bgcolor: selected ? '#ffffff' : '#1a1a1a',
                                                color: selected ? '#000000' : '#858585',
                                            }}
                                        >
                                            {path.icon}
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: selected ? '#ffffff' : '#858585' }}>
                                                {path.title}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#666666' }}>
                                                {path.description}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <Stack spacing={3}>
                            {action === 'create' ? (
                                <TextField
                                    fullWidth
                                    placeholder="Workspace name (e.g. Pacific Ops)"
                                    variant="outlined"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    disabled={loading}
                                    autoFocus
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            bgcolor: '#111111',
                                            color: '#ffffff',
                                            borderRadius: 2,
                                            '& fieldset': { borderColor: '#333333' },
                                            '&:hover fieldset': { borderColor: '#444444' },
                                            '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                                        },
                                    }}
                                />
                            ) : (
                                <TextField
                                    fullWidth
                                    placeholder="Workspace ID (e.g. 1A2B3C)"
                                    type="text"
                                    variant="outlined"
                                    value={orgId}
                                    onChange={(e) => setOrgId(e.target.value)}
                                    disabled={loading}
                                    autoFocus
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            bgcolor: '#111111',
                                            color: '#ffffff',
                                            borderRadius: 2,
                                            '& fieldset': { borderColor: '#333333' },
                                            '&:hover fieldset': { borderColor: '#444444' },
                                            '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                                        },
                                    }}
                                />
                            )}

                            <Button
                                type="submit"
                                fullWidth
                                size="large"
                                variant="contained"
                                disabled={loading || (action === 'create' ? !orgName : !orgId)}
                                sx={{
                                    py: 1.2,
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    bgcolor: (action === 'create' ? orgName : orgId) ? '#ffffff' : '#333333',
                                    color: (action === 'create' ? orgName : orgId) ? '#000000' : '#666666',
                                    '&:hover': {
                                        bgcolor: (action === 'create' ? orgName : orgId) ? '#e0e0e0' : '#444444',
                                    },
                                    '&.Mui-disabled': {
                                        bgcolor: '#1a1a1a',
                                        color: '#444444',
                                    },
                                    transition: 'all 0.2s',
                                }}
                            >
                                {loading ? (
                                    <CircularProgress size={20} color="inherit" />
                                ) : action === 'create' ? (
                                    'Create Workspace'
                                ) : (
                                    'Join Workspace'
                                )}
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Container>
        </Box >
    );
}
