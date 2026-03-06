import { createFileRoute, Link } from '@tanstack/react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

export const Route = createFileRoute('/privacy')({
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
                    Privacy Policy
                </Typography>

                <Typography variant="body2" sx={{ color: '#a0a0a0', mb: 3 }}>
                    Last updated: March 2026
                </Typography>

                <Stack spacing={3} sx={{ color: '#c0c0c0', fontSize: '0.95rem', lineHeight: 1.7 }}>
                    <Typography>
                        At Timey, we take your privacy seriously. This Privacy Policy describes how we 
                        collect, use, and protect your personal information.
                    </Typography>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            1. Information We Collect
                        </Typography>
                        <Typography>
                            We collect information you provide when creating an account, such as your 
                            email address and name. We also collect messages, files, and other content 
                            you share through the service.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            2. How We Use Your Information
                        </Typography>
                        <Typography>
                            We use your information to provide, maintain, and improve our services. 
                            This includes authenticating your account, sending you notifications, and 
                            providing customer support.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            3. Data Storage
                        </Typography>
                        <Typography>
                            Your data is stored on servers operated by SpacetimeDB. By using Timey, 
                            you consent to the transfer and storage of your data on these servers.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            4. Data Security
                        </Typography>
                        <Typography>
                            We implement appropriate security measures to protect your personal 
                            information against unauthorized access, alteration, disclosure, or destruction.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            5. Sharing Your Information
                        </Typography>
                        <Typography>
                            We do not sell, trade, or otherwise transfer your personal information to 
                            outside parties. We may share information with service providers who assist 
                            us in operating our service.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            6. Your Rights
                        </Typography>
                        <Typography>
                            You have the right to access, update, or delete your personal information 
                            at any time. You may also request a copy of your data.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            7. Changes to This Policy
                        </Typography>
                        <Typography>
                            We may update this Privacy Policy from time to time. We will notify you 
                            of any changes by posting the new policy on this page.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
                            8. Contact Us
                        </Typography>
                        <Typography>
                            If you have any questions about this Privacy Policy, please contact us at 
                            support@timey.app.
                        </Typography>
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
}
