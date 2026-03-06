import { createFileRoute, Link } from '@tanstack/react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

export const Route = createFileRoute('/terms')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#000000',
                color: '#ffffff',
            }}
        >
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Stack spacing={3} sx={{ mb: 4 }}>
                    <Button
                        component={Link}
                        href="/login"
                        startIcon={<ArrowBackRoundedIcon />}
                        sx={{
                            color: '#858585',
                            textTransform: 'none',
                            alignSelf: 'flex-start',
                            '&:hover': { color: '#ffffff' },
                        }}
                    >
                        Back to login
                    </Button>
                </Stack>

                <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                    Terms of Service
                </Typography>

                <Typography variant="body2" sx={{ color: '#a0a0a0', mb: 3 }}>
                    Last updated: March 2026
                </Typography>

                <Stack spacing={3} sx={{ color: '#c0c0c0', fontSize: '0.95rem', lineHeight: 1.7 }}>
                    <Typography>
                        By accessing and using Timey, you agree to be bound by these Terms of Service. 
                        If you do not agree to these terms, please do not use our service.
                    </Typography>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            1. Acceptance of Terms
                        </Typography>
                        <Typography>
                            By creating an account or using Timey, you acknowledge that you have read, 
                            understood, and agree to be bound by these Terms of Service.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            2. Use License
                        </Typography>
                        <Typography>
                            Timey grants you a limited, non-exclusive, non-transferable license to use 
                            our service for personal or business communication purposes.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            3. User Conduct
                        </Typography>
                        <Typography>
                            You agree not to use the service for any unlawful purpose or in any way that 
                            could damage, disable, or impair the service. You are responsible for all 
                            activity under your account.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            4. Privacy
                        </Typography>
                        <Typography>
                            Your privacy is important to us. Please review our Privacy Policy to understand 
                            how we collect, use, and protect your information.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            5. Termination
                        </Typography>
                        <Typography>
                            We reserve the right to terminate or suspend your account at any time for 
                            any reason without notice.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            6. Contact Information
                        </Typography>
                        <Typography>
                            If you have any questions about these Terms of Service, please contact us at 
                            support@timey.app.
                        </Typography>
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
}
