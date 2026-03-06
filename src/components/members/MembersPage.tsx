import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import { useNavigate } from '@tanstack/react-router';
import { useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { InviteSection } from '../dashboard/Dashboard';
import { tables } from '../../module_bindings';
import { sendInviteEmail } from '../../server/invites';
import { toast } from 'sonner';

function MemberActions({
    entry,
    orgName,
    token
}: {
    entry: any;
    orgName: string;
    token: string;
}) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [loading, setLoading] = useState(false);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleResendRecord = async () => {
        handleClose();
        setLoading(true);
        try {
            await sendInviteEmail({
                data: {
                    email: entry.email,
                    orgName: orgName,
                    token: token
                } as any
            });
            toast.success(`Resent invitation to ${entry.email}`);
        } catch (err) {
            console.error('Failed to resend invite:', err);
            toast.error('Failed to resend invitation. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: 48, textAlign: 'right' }}>
            <IconButton
                size="small"
                onClick={handleClick}
                disabled={loading}
                sx={{ color: '#858585' }}
            >
                {loading ? <CircularProgress size={16} color="inherit" /> : <MoreVertIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        bgcolor: '#111',
                        border: '1px solid #222',
                        color: '#ffffff',
                        minWidth: 160,
                        mt: 0.5,
                        '& .MuiMenuItem-root': {
                            fontSize: '0.8rem',
                            py: 1,
                            gap: 1.5,
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' }
                        }
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                {entry.status === 'pending' && (
                    <MenuItem onClick={handleResendRecord}>
                        <MailOutlineRoundedIcon sx={{ fontSize: 16, color: '#858585' }} />
                        Resend Invitation
                    </MenuItem>
                )}
                <MenuItem onClick={handleClose} sx={{ color: '#666' }}>
                    View Profile
                </MenuItem>
            </Menu>
        </Box>
    );
}

export function MembersPage() {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership } = useOrganizationMembership({
        enabled: isAuthenticated,
    });

    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [allMemberships] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allInvites] = useSpacetimeDBQuery(isAuthenticated ? tables.invite : 'skip');
    const [organizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [joinIds] = useSpacetimeDBQuery(isAuthenticated ? tables.join_id : 'skip');

    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate({ to: '/login' });
        }
    }, [isLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && !isCheckingMembership && !hasOrganization) {
            navigate({ to: '/onboarding' });
        }
    }, [hasOrganization, isAuthenticated, isCheckingMembership, isLoading, navigate]);

    if (isLoading || (isAuthenticated && isCheckingMembership)) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#000000' }}>
                <CircularProgress size={24} sx={{ color: '#ffffff' }} />
            </Box>
        );
    }

    if (!isAuthenticated || !hasOrganization) return null;

    const currentMembership = memberships[0];
    const currentOrgId = currentMembership?.orgId;
    const isOwner = currentMembership?.role === 'owner';

    const currentOrg = organizations.find(org => org.id === currentOrgId);
    const orgName = currentOrg?.name || 'Workspace';

    // Find the active token for this organization
    const activeJoinId = joinIds.find(j => j.orgId === currentOrgId && !j.isRevoked);
    const token = activeJoinId?.token || '';

    // Filter active members for THIS organization
    const orgMembers = allMemberships.filter(m => m.orgId === currentOrgId);

    // Map memberships to user details
    const activeMembers = orgMembers.map(m => {
        const user = allUsers.find(u => u.id === m.userId);
        return {
            id: m.id,
            email: user?.email || 'Unknown',
            name: user?.name || 'Unknown User',
            role: m.role,
            status: 'active' as const,
            joinedAt: m.joinedAt
        };
    });

    // Filter pending invites for THIS organization
    const pendingInvites = allInvites
        .filter(i => i.orgId === currentOrgId && i.status === 'pending')
        .map(i => ({
            id: i.id,
            email: i.email,
            name: i.email.split('@')[0],
            role: 'member', // Default role for invites
            status: 'pending' as const,
            joinedAt: i.createdAt
        }));

    // Combine and sort (Owners first, then by name)
    const allEntries = [...activeMembers, ...pendingInvites].sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <DashboardLayout onLogout={logout} orgName={orgName}>
            <Box sx={{ width: '100%', p: { xs: 4, md: 6 }, pb: 12 }}>
                <Stack spacing={6}>
                    {/* Header with Invite */}
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={4}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Stack spacing={1}>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                                Members
                            </Typography>
                            <Typography variant="body1" sx={{ color: '#858585' }}>
                                Manage your team and track invitation statuses.
                            </Typography>
                        </Stack>

                        {isOwner && (
                            <Box sx={{ minWidth: { md: 400 } }}>
                                <InviteSection
                                    orgId={currentOrgId || 0n}
                                    orgName={orgName}
                                    token={token}
                                    showRegenerate={true}
                                />
                            </Box>
                        )}
                    </Stack>

                    {/* Members List */}
                    <Paper
                        sx={{
                            bgcolor: '#050505',
                            border: '1px solid #1a1a1a',
                            borderRadius: 2,
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600, flex: 1 }}>
                                    Name
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: '#858585', width: 100 }}>
                                    Role
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: '#858585', width: 120, textAlign: 'right' }}>
                                    Status
                                </Typography>
                                <Box sx={{ width: 48 }} />
                            </Stack>
                        </Box>

                        <Stack divider={<Divider sx={{ borderColor: '#111' }} />}>
                            {allEntries.map((entry) => (
                                <Box
                                    key={`${entry.status}-${entry.id}`}
                                    sx={{
                                        p: 2,
                                        transition: 'background-color 0.2s',
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' }
                                    }}
                                >
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                                            <Avatar
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    bgcolor: entry.status === 'active' ? '#2e7d32' : '#333',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    opacity: entry.status === 'active' ? 1 : 0.6
                                                }}
                                            >
                                                {entry.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#ffffff' }}>
                                                    {entry.name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#666' }}>
                                                    {entry.email}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        <Box sx={{ width: 100 }}>
                                            <Typography variant="caption" sx={{ color: '#ffffff', textTransform: 'capitalize' }}>
                                                {entry.role}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ width: 120, textAlign: 'right' }}>
                                            <Chip
                                                label={entry.status === 'active' ? 'Joined' : 'Pending'}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    bgcolor: entry.status === 'active' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                                                    color: entry.status === 'active' ? '#4caf50' : '#ff9800',
                                                    border: '1px solid',
                                                    borderColor: entry.status === 'active' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                                                }}
                                            />
                                        </Box>

                                        <MemberActions
                                            entry={entry}
                                            orgName={orgName}
                                            token={token}
                                        />
                                    </Stack>
                                </Box>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </Box>
        </DashboardLayout>
    );
}
