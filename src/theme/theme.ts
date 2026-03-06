import { alpha, createTheme } from '@mui/material/styles';

const sharedTypography = {
    fontFamily: "'Instrument Sans', 'IBM Plex Sans', sans-serif",
    h1: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.04em',
        lineHeight: 1,
    },
    h2: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.04em',
        lineHeight: 1.05,
    },
    h3: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.03em',
    },
    h4: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.03em',
    },
    h5: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.02em',
    },
    h6: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '-0.02em',
    },
    button: {
        textTransform: 'none' as const,
        fontWeight: 700,
        letterSpacing: '-0.02em',
    },
    overline: {
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
    },
};

const sharedComponents = {
    MuiButton: {
        styleOverrides: {
            root: {
                borderRadius: 18,
                padding: '12px 24px',
                fontSize: '0.9375rem',
            },
            sizeLarge: {
                padding: '15px 30px',
                fontSize: '1rem',
            },
        },
        defaultProps: {
            disableElevation: true,
        },
    },
    MuiTextField: {
        defaultProps: {
            variant: 'outlined' as const,
            size: 'medium' as const,
        },
        styleOverrides: {
            root: {
                '& .MuiOutlinedInput-root': {
                    borderRadius: 20,
                },
            },
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                borderRadius: 24,
            },
        },
        defaultProps: {
            elevation: 0,
        },
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                borderRadius: 24,
            },
        },
    },
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: 999,
                fontWeight: 600,
                letterSpacing: '-0.01em',
            },
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                borderRadius: 16,
            },
        },
    },
};

export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#0f766e',
            light: '#2f938a',
            dark: '#0b5a54',
            contrastText: '#f7f3ec',
        },
        secondary: {
            main: '#de6a3c',
            light: '#ef875f',
            dark: '#b45028',
        },
        error: {
            main: '#c75656',
        },
        warning: {
            main: '#d8a241',
            dark: '#a96f16',
        },
        success: {
            main: '#2e8c67',
        },
        background: {
            default: '#f5efe6',
            paper: '#fbf7f0',
        },
        text: {
            primary: '#121a1d',
            secondary: '#5a6669',
        },
        divider: 'rgba(18, 26, 29, 0.08)',
    },
    typography: {
        ...sharedTypography,
        body1: {
            fontSize: '1rem',
            lineHeight: 1.65,
        },
        body2: {
            fontSize: '0.95rem',
            lineHeight: 1.6,
        },
    },
    shape: { borderRadius: 20 },
    components: {
        ...sharedComponents,
        MuiCard: {
            ...sharedComponents.MuiCard,
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    border: '1px solid rgba(18, 26, 29, 0.08)',
                    boxShadow: '0 18px 48px rgba(18, 26, 29, 0.08)',
                    backgroundImage: 'none',
                    backgroundColor: alpha('#fbf7f0', 0.9),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiPaper: {
            ...sharedComponents.MuiPaper,
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    backgroundImage: 'none',
                    backgroundColor: alpha('#fbf7f0', 0.92),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: alpha('#fbf7f0', 0.82),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiTextField: {
            ...sharedComponents.MuiTextField,
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 20,
                        backgroundColor: alpha('#ffffff', 0.7),
                    },
                },
            },
        },
    },
});

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#7dd6cb',
            light: '#a5ebe3',
            dark: '#3d9288',
            contrastText: '#081214',
        },
        secondary: {
            main: '#ff9a6a',
            light: '#ffb48d',
            dark: '#c96c42',
        },
        error: {
            main: '#f27474',
        },
        warning: {
            main: '#e5b55a',
            dark: '#bb8330',
        },
        success: {
            main: '#5dcb9b',
        },
        background: {
            default: '#081214',
            paper: '#0f1a1d',
        },
        text: {
            primary: '#edf4f2',
            secondary: '#98a6a7',
        },
        divider: 'rgba(255, 255, 255, 0.10)',
    },
    typography: {
        ...sharedTypography,
        body1: {
            fontSize: '1rem',
            lineHeight: 1.65,
        },
        body2: {
            fontSize: '0.95rem',
            lineHeight: 1.6,
        },
    },
    shape: { borderRadius: 20 },
    components: {
        ...sharedComponents,
        MuiCard: {
            ...sharedComponents.MuiCard,
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 24px 72px rgba(0, 0, 0, 0.30)',
                    backgroundImage: 'none',
                    backgroundColor: alpha('#0f1a1d', 0.9),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiPaper: {
            ...sharedComponents.MuiPaper,
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    backgroundImage: 'none',
                    backgroundColor: alpha('#0f1a1d', 0.9),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: alpha('#0a1214', 0.86),
                    backdropFilter: 'blur(14px)',
                },
            },
        },
        MuiTextField: {
            ...sharedComponents.MuiTextField,
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 20,
                        backgroundColor: alpha('#142225', 0.7),
                    },
                },
            },
        },
    },
});
