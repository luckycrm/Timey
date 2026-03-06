import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import { useNavigate } from '@tanstack/react-router';
import { useReducer, useSpacetimeDB } from 'spacetimedb/tanstack';
import { reducers } from '../../module_bindings';
import { requestOtp, verifyOtp } from '../../server/otp';
import { AppLogo } from '../common/AppLogo';
import { toast } from 'sonner';

export function LoginForm() {
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const navigate = useNavigate();

    const conn = useSpacetimeDB();
    const registerUser = useReducer(reducers.registerUser);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const isRequestingOtpRef = useRef(false);
    const isVerifyingOtpRef = useRef(false);

    const normalizedEmail = email.trim().toLowerCase();

    useEffect(() => {
        if (step === 'otp') {
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
            setResendTimer(60);
        }
    }, [step]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!normalizedEmail || loading || isRequestingOtpRef.current) return;

        isRequestingOtpRef.current = true;
        setLoading(true);

        try {
            const result = await requestOtp({ data: { email: normalizedEmail } as any });
            if (result.success) {
                toast.success('Access code sent. Check your inbox.');
                setStep('otp');
            } else {
                toast.error(result.error || 'Failed to send code');
            }
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            isRequestingOtpRef.current = false;
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const nextOtp = [...otp];
            digits.forEach((digit, digitIndex) => {
                if (index + digitIndex < 6) nextOtp[index + digitIndex] = digit;
            });
            setOtp(nextOtp);
            otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
            if (nextOtp.every((digit) => digit !== '')) {
                void handleVerifyOtp(nextOtp.join(''));
            }
            return;
        }

        if (value && !/^\d$/.test(value)) return;

        const nextOtp = [...otp];
        nextOtp[index] = value;
        setOtp(nextOtp);

        if (value && index < 5) otpRefs.current[index + 1]?.focus();
        if (value && nextOtp.every((digit) => digit !== '')) {
            void handleVerifyOtp(nextOtp.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (code?: string) => {
        const otpCode = (code || otp.join('')).replace(/\D/g, '').slice(0, 6);
        if (otpCode.length !== 6 || loading || isVerifyingOtpRef.current) return;

        isVerifyingOtpRef.current = true;
        setLoading(true);

        try {
            const result = await verifyOtp({
                data: { email: normalizedEmail, code: otpCode } as any,
            });

            if (result.success) {
                if (conn.isActive) {
                    try {
                        await registerUser({
                            email: normalizedEmail,
                            name: normalizedEmail.split('@')[0],
                        });
                    } catch {
                        // Best effort user registration.
                    }
                }
                toast.success('Verified. Opening your workspace…');
                setTimeout(() => navigate({ to: '/' }), 420);
            } else {
                toast.error(result.error || 'Invalid code');
                setOtp(['', '', '', '', '', '']);
                otpRefs.current[0]?.focus();
            }
        } catch {
            toast.error('Verification failed. Please try again.');
        } finally {
            isVerifyingOtpRef.current = false;
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0 || loading || isRequestingOtpRef.current) return;
        setOtp(['', '', '', '', '', '']);
        isRequestingOtpRef.current = true;
        setLoading(true);

        try {
            const result = await requestOtp({ data: { email: normalizedEmail } as any });
            if (result.success) {
                toast.success('A fresh code is on the way.');
                setResendTimer(60);
            }
        } catch {
            toast.error('Failed to resend. Please try again.');
        } finally {
            isRequestingOtpRef.current = false;
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#000000',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    px: { xs: 2.5, sm: 4 },
                    py: 3,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                {/* Empty header for spacing or future links */}
            </Box>

            {/* Main Content */}
            <Container
                maxWidth="xs"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    pb: 12,
                }}
            >
                <Stack spacing={4} alignItems="center">
                    <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center' }}>
                        <AppLogo color="#ffffff" />
                        <Typography variant="body1" sx={{ color: '#858585', fontSize: '0.95rem' }}>
                            Welcome back to Timey.
                        </Typography>
                    </Stack>

                    <Box sx={{ width: '100%' }}>
                        {step === 'email' ? (
                            <EmailStep
                                email={email}
                                setEmail={setEmail}
                                loading={loading}
                                onSubmit={handleRequestOtp}
                            />
                        ) : (
                            <OtpStep
                                otp={otp}
                                otpRefs={otpRefs}
                                loading={loading}
                                resendTimer={resendTimer}
                                onOtpChange={handleOtpChange}
                                onOtpKeyDown={handleOtpKeyDown}
                                onVerify={() => {
                                    void handleVerifyOtp();
                                }}
                                onResend={handleResend}
                                onChangeEmail={() => {
                                    setStep('email');
                                    setOtp(['', '', '', '', '', '']);
                                }}
                            />
                        )}
                    </Box>

                    <Typography variant="caption" sx={{ color: '#555555', textAlign: 'center', px: 2 }}>
                        By signing in, you understand and agree to our{' '}
                        <Link href="#" underline="always" sx={{ color: 'inherit' }}>
                            Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="#" underline="always" sx={{ color: 'inherit' }}>
                            Privacy Policy
                        </Link>
                        .
                    </Typography>
                </Stack>
            </Container>
        </Box>
    );
}

function EmailStep({
    email,
    setEmail,
    loading,
    onSubmit,
}: {
    email: string;
    setEmail: (value: string) => void;
    loading: boolean;
    onSubmit: (event: React.FormEvent) => void;
}) {
    const normalizedEmail = email.trim().toLowerCase();

    return (
        <form onSubmit={onSubmit}>
            <Stack spacing={2.5}>
                <TextField
                    fullWidth
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                    autoComplete="email"
                    type="email"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#111111',
                            color: '#ffffff',
                            '& fieldset': { borderColor: '#333333' },
                            '&:hover fieldset': { borderColor: '#444444' },
                            '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                        },
                    }}
                />
                <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={!normalizedEmail || loading}
                    sx={{
                        bgcolor: normalizedEmail ? '#ffffff' : '#333333',
                        color: normalizedEmail ? '#000000' : '#666666',
                        textTransform: 'none',
                        py: 1.2,
                        fontWeight: 600,
                        '&:hover': {
                            bgcolor: normalizedEmail ? '#e0e0e0' : '#444444'
                        },
                        '&.Mui-disabled': {
                            bgcolor: '#1a1a1a',
                            color: '#444444'
                        },
                        transition: 'all 0.2s ease-in-out',
                    }}
                >
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Continue'}
                </Button>
            </Stack>
        </form>
    );
}

function OtpStep({
    otp,
    otpRefs,
    loading,
    resendTimer,
    onOtpChange,
    onOtpKeyDown,
    onVerify,
    onResend,
    onChangeEmail,
}: {
    otp: string[];
    otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
    loading: boolean;
    resendTimer: number;
    onOtpChange: (index: number, value: string) => void;
    onOtpKeyDown: (index: number, e: React.KeyboardEvent) => void;
    onVerify: () => void;
    onResend: () => void;
    onChangeEmail: () => void;
}) {
    return (
        <Stack spacing={4}>
            <Stack direction="row" spacing={1} justifyContent="center">
                {otp.map((digit, index) => (
                    <Box
                        key={index}
                        component="input"
                        ref={(element: HTMLInputElement | null) => {
                            otpRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onOtpChange(index, e.target.value)
                        }
                        onKeyDown={(e: React.KeyboardEvent) => onOtpKeyDown(index, e)}
                        disabled={loading}
                        sx={{
                            width: 48,
                            height: 56,
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            bgcolor: '#111111',
                            border: '1px solid',
                            borderColor: digit ? '#ffffff' : '#333333',
                            borderRadius: 1,
                            outline: 'none',
                            transition: 'all 0.16s ease',
                            '&:focus': {
                                borderColor: '#ffffff',
                                boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.1)',
                            },
                        }}
                    />
                ))}
            </Stack>

            <Button
                variant="contained"
                fullWidth
                disabled={otp.join('').length !== 6 || loading}
                onClick={onVerify}
                sx={{
                    bgcolor: otp.join('').length === 6 ? '#ffffff' : '#333333',
                    color: otp.join('').length === 6 ? '#000000' : '#666666',
                    textTransform: 'none',
                    py: 1.2,
                    fontWeight: 600,
                    '&:hover': {
                        bgcolor: otp.join('').length === 6 ? '#e0e0e0' : '#444444'
                    },
                    '&.Mui-disabled': {
                        bgcolor: '#1a1a1a',
                        color: '#444444'
                    },
                    transition: 'all 0.2s',
                }}
            >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify and continue'}
            </Button>

            <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    onClick={onResend}
                    disabled={loading || resendTimer > 0}
                    sx={{
                        color: '#858585',
                        borderColor: '#333333',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': {
                            borderColor: '#444444',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            color: '#ffffff'
                        },
                        '&.Mui-disabled': {
                            borderColor: '#222222',
                            color: '#444444'
                        }
                    }}
                >
                    {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend'}
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    onClick={onChangeEmail}
                    disabled={loading}
                    sx={{
                        color: '#858585',
                        borderColor: '#333333',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': {
                            borderColor: '#444444',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            color: '#ffffff'
                        }
                    }}
                >
                    Change email
                </Button>
            </Stack>
        </Stack>
    );
}
