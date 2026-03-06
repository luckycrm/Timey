import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import { useNavigate } from '@tanstack/react-router';
import { useSpacetimeDBQuery, useReducer } from 'spacetimedb/tanstack';
import { toast } from 'sonner';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';
import { DashboardLayout } from '../layout/DashboardLayout';
import { tables, reducers } from '../../module_bindings';
import { sendInviteEmail } from '../../server/invites';


function EmptyTeamCard({
    orgId,
    orgName,
    token,
    isOwner
}: {
    orgId: bigint;
    orgName: string;
    token: string;
    isOwner: boolean;
}) {
    return (
        <Paper
            sx={{
                p: { xs: 4, md: 6 },
                bgcolor: '#000000',
                border: '1px solid #1a1a1a',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                maxWidth: 600,
                mx: 'auto',
                mt: 4,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #333, transparent)'
                }
            }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    color: '#858585',
                    border: '1px solid #1a1a1a'
                }}
            >
                <GroupAddRoundedIcon sx={{ fontSize: 32 }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff', mb: 1.5, letterSpacing: '-0.01em' }}>
                Build your team
            </Typography>
            <Typography variant="body1" sx={{ color: '#666', mb: 4, maxWidth: 400, lineHeight: 1.6 }}>
                You're currently in this workspace solo. High-performance teams start with the first invitation.
            </Typography>

            {isOwner && (
                <Box sx={{ width: '100%', pt: 4, borderTop: '1px solid #111' }}>
                    <Stack spacing={2} alignItems="center">
                        <Typography variant="caption" sx={{ color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                            Quick Invite
                        </Typography>
                        <InviteSection
                            orgId={orgId}
                            orgName={orgName}
                            token={token}
                            showRegenerate={false}
                        />
                    </Stack>
                </Box>
            )}
        </Paper>
    );
}

function TeamWidget({
    orgId,
    orgName,
    token,
    members,
    pendingInvites,
    onManage
}: {
    orgId: bigint;
    orgName: string;
    token: string;
    members: any[];
    pendingInvites: any[];
    onManage: () => void;
}) {
    return (
        <Paper
            sx={{
                p: 2.5,
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid #1a1a1a',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
                width: { md: 500 }
            }}
        >
            {/* Team Summary Part */}
            <Stack direction="row" spacing={2.5} alignItems="center" justifyContent="space-between" sx={{ px: 0.5 }}>
                <Stack direction="row" spacing={2.5} alignItems="center">
                    <Stack direction="row" spacing={-1.2}>
                        {/* Active Members */}
                        {members.slice(0, 4).map((m, i) => (
                            <Tooltip key={m.id} title={`${m.name} (Active)`}>
                                <Avatar
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        border: '3px solid #0a0a0a',
                                        bgcolor: m.role === 'owner' ? '#1b5e20' : '#222',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        zIndex: 20 - i,
                                        color: '#fff',
                                        cursor: 'default'
                                    }}
                                >
                                    {m.name.charAt(0).toUpperCase()}
                                </Avatar>
                            </Tooltip>
                        ))}
                        {/* Pending Invites */}
                        {pendingInvites.length > 0 && pendingInvites.slice(0, 3).map((invite, i) => {
                            const colors = ['#1565c0', '#00695c', '#ef6c00', '#c62828', '#6a1b9a', '#0277bd'];
                            const colorIndex = invite.email.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length;
                            return (
                                <Tooltip key={invite.id || `pending-${i}`} title={`Pending: ${invite.email}`}>
                                    <Avatar
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            border: '3px solid #0a0a0a',
                                            bgcolor: colors[colorIndex],
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            zIndex: 10 - i,
                                            color: '#fff',
                                            cursor: 'default',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {invite.email.charAt(0)}
                                    </Avatar>
                                </Tooltip>
                            );
                        })}

                        {(members.length + pendingInvites.length) > 7 && (
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    border: '3px solid #0a0a0a',
                                    bgcolor: '#111',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    color: '#555',
                                    zIndex: 0,
                                    fontFamily: 'monospace',
                                    fontWeight: 800
                                }}
                            >
                                +{(members.length + pendingInvites.length) - 7}
                            </Box>
                        )}
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, lineHeight: 1.1, fontSize: '0.9rem' }}>
                            {members.length + pendingInvites.length} total
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" sx={{ color: '#858585', fontWeight: 600, fontSize: '0.7rem' }}>
                                {members.length} active
                            </Typography>
                            {pendingInvites.length > 0 && (
                                <>
                                    <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#333' }} />
                                    <Typography variant="caption" sx={{ color: '#ff9800', fontWeight: 700, fontSize: '0.7rem' }}>
                                        {pendingInvites.length} pending
                                    </Typography>
                                </>
                            )}
                        </Stack>
                    </Stack>
                </Stack>

                <Button
                    size="small"
                    onClick={onManage}
                    sx={{
                        minWidth: 0,
                        p: 1,
                        borderRadius: 1.5,
                        color: '#444',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid #1a1a1a',
                        '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.05)', borderColor: '#333' }
                    }}
                >
                    <PeopleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                </Button>
            </Stack>

            <Divider sx={{ borderColor: '#1a1a1a' }} />

            {/* Invite Part */}
            <Box>
                <InviteSection
                    orgId={orgId}
                    orgName={orgName}
                    token={token}
                    showRegenerate={false}
                />
            </Box>
        </Paper>
    );
}

export function InviteSection({
    orgId,
    orgName,
    token,
    showRegenerate = false
}: {
    orgId: bigint;
    orgName: string;
    token: string;
    showRegenerate?: boolean;
}) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const createInvite = useReducer(reducers.createInvite);
    const generateJoinId = useReducer(reducers.generateJoinId);

    const handleInvite = async () => {
        if (!email || !email.includes('@')) return;
        setLoading(true);
        try {
            await createInvite({ orgId: orgId, email: email.trim() });
            await sendInviteEmail({
                data: {
                    email: email.trim(),
                    orgName: orgName,
                    token: token
                } as any
            });
            toast.success(`Invitation sent to ${email.trim()}!`);
            setEmail('');
        } catch (err: any) {
            console.error('Invite failed:', err);
            toast.error(err?.message || 'Failed to send invitation. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        if (regenerating) return;
        setRegenerating(true);
        try {
            await generateJoinId({ orgId });
            toast.success('Workspace ID regenerated!');
        } catch (err) {
            console.error('Failed to regenerate Join ID:', err);
            toast.error('Failed to regenerate ID.');
        } finally {
            setRegenerating(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr minmax(130px, auto)' },
                gap: 1.5,
                alignItems: 'center'
            }}
        >
            <Box
                sx={{
                    bgcolor: '#111',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #222',
                    minWidth: { xs: '100%', sm: 260 },
                    '&:focus-within': { borderColor: '#444' }
                }}
            >
                <InputBase
                    placeholder="Invite by email..."
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    fullWidth
                    sx={{ color: '#ffffff', fontSize: '0.85rem' }}
                />
            </Box>
            <Button
                variant="contained"
                onClick={handleInvite}
                disabled={loading || !email.includes('@')}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AddRoundedIcon />}
                sx={{
                    bgcolor: '#ffffff',
                    color: '#000000',
                    height: 38,
                    px: 2.5,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    width: '100%',
                    justifyContent: 'center',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
                    '&.Mui-disabled': { bgcolor: '#333', color: '#666' }
                }}
            >
                {loading ? '...' : 'Invite'}
            </Button>

            {token && (
                <>
                    <Typography variant="caption" sx={{ color: '#666', fontWeight: 500, fontStyle: 'italic' }}>
                        or share this code for members to join:
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        <Tooltip title="Workspace ID (Hover to reveal, click to copy)">
                            <Chip
                                label={showToken ? token : '••••••••'}
                                onMouseEnter={() => setShowToken(true)}
                                onMouseLeave={() => setShowToken(false)}
                                onClick={() => {
                                    navigator.clipboard.writeText(token);
                                    toast.success('Workspace ID copied!');
                                }}
                                icon={<ContentCopyRoundedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                                sx={{
                                    bgcolor: '#ffffff',
                                    color: '#000000',
                                    height: 38,
                                    px: 1,
                                    borderRadius: 1.5,
                                    fontSize: '0.85rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    width: showRegenerate ? 'auto' : '100%',
                                    flexGrow: 1,
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.9)'
                                    },
                                    '& .MuiChip-icon': {
                                        ml: 0.5,
                                        mr: -1,
                                        opacity: 0.8
                                    },
                                    '& .MuiChip-label': {
                                        filter: showToken ? 'none' : 'blur(4px)',
                                        transition: 'filter 0.2s',
                                        px: 2
                                    },
                                    cursor: 'pointer'
                                }}
                            />
                        </Tooltip>

                        {showRegenerate && (
                            <IconButton
                                size="small"
                                onClick={handleRegenerate}
                                disabled={regenerating}
                                sx={{
                                    color: '#444',
                                    '&:hover': { color: '#858585' }
                                }}
                            >
                                {regenerating ? <CircularProgress size={14} color="inherit" /> : <RefreshRoundedIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                        )}
                    </Stack>
                </>
            )}
        </Box>
    );
}

export function Dashboard() {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const { memberships, hasOrganization, isCheckingMembership } = useOrganizationMembership({
        enabled: isAuthenticated,
    });
    const [allMemberships] = useSpacetimeDBQuery(isAuthenticated ? tables.organization_member : 'skip');
    const [allInvites] = useSpacetimeDBQuery(isAuthenticated ? tables.invite : 'skip');
    const [allUsers] = useSpacetimeDBQuery(isAuthenticated ? tables.user : 'skip');
    const [organizations] = useSpacetimeDBQuery(isAuthenticated ? tables.organization : 'skip');
    const [joinIds] = useSpacetimeDBQuery(isAuthenticated ? tables.join_id : 'skip');
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) navigate({ to: '/login' });
    }, [isLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && !isCheckingMembership && !hasOrganization) navigate({ to: '/onboarding' });
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
    const activeJoinId = joinIds.find(j => j.orgId === currentOrgId && !j.isRevoked);
    const token = activeJoinId?.token || '';

    // Find current user details
    const currentUser = allUsers.find(u => u.id === currentMembership.userId);
    const formattedName = currentUser?.name || (currentMembership.role === 'owner' ? 'Founder' : 'Member');

    // Check if there are other members or pending invites
    const orgMembers = allMemberships.filter(m => m.orgId === currentOrgId);
    const otherMembers = orgMembers.filter(m => m.userId !== currentMembership.userId);
    const pendingInvites = allInvites.filter(i => i.orgId === currentOrgId && i.status === 'pending');
    const isSolo = otherMembers.length === 0 && pendingInvites.length === 0;

    // Prepare members data for TeamOverviewCard (excluding current user)
    const displayMembers = otherMembers.map(m => {
        const user = allUsers.find(u => u.id === m.userId);
        return {
            id: m.id,
            name: user?.name || 'Unknown',
            role: m.role
        };
    }).sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <DashboardLayout onLogout={logout} orgName={orgName}>
            <Box sx={{ width: '100%', p: { xs: 4, md: 6 }, pb: 12 }}>
                <Stack spacing={8}>
                    {/* Welcome Header */}
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={4}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                        sx={{ position: 'relative' }}
                    >
                        <Stack spacing={1}>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                                Hey {formattedName}, welcome aboard! 👋
                            </Typography>
                            <Typography variant="body1" sx={{ color: '#858585' }}>
                                Your operating flow starts here. Everything you need is on the left.
                            </Typography>
                        </Stack>

                        {isOwner && !isSolo && (
                            <TeamWidget
                                orgId={currentOrgId || 0n}
                                orgName={orgName}
                                token={token}
                                members={displayMembers}
                                pendingInvites={pendingInvites}
                                onManage={() => navigate({ to: '/members' })}
                            />
                        )}
                    </Stack>

                    {isSolo ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                            <EmptyTeamCard
                                orgId={currentOrgId || 0n}
                                orgName={orgName}
                                token={token}
                                isOwner={isOwner}
                            />
                        </Box>
                    ) : (
                        /* Future dashboard content (projects, stats, etc.) will go here */
                        null
                    )}
                </Stack>
            </Box>
        </DashboardLayout>
    );
}
