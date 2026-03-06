import {
    createContext,
    useContext,
    useState,
    useMemo,
    useCallback,
    useEffect,
    type ReactNode,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
    mode: ThemeMode;
    toggleTheme: () => void;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'light',
    toggleTheme: () => { },
    setMode: () => { },
});

export function useThemeMode() {
    return useContext(ThemeContext);
}

function getInitialMode(): ThemeMode {
    try {
        const stored = localStorage.getItem('timey-theme');
        if (stored === 'dark' || stored === 'light') return stored;
    } catch {
        // SSR or localStorage unavailable
    }
    return 'light';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

    const toggleTheme = useCallback(() => {
        setModeState((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            try { localStorage.setItem('timey-theme', next); } catch { }
            return next;
        });
    }, []);

    const setMode = useCallback((m: ThemeMode) => {
        setModeState(m);
        try { localStorage.setItem('timey-theme', m); } catch { }
    }, []);

    const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

    const value = useMemo(() => ({ mode, toggleTheme, setMode }), [mode, toggleTheme, setMode]);

    useEffect(() => {
        document.documentElement.dataset.themeMode = mode;
    }, [mode]);

    return (
        <ThemeContext.Provider value={value}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
}
