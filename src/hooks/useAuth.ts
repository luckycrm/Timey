import { useState, useEffect, useCallback } from 'react';
import { getSession, logout as logoutFn } from '../server/otp';
import { resetClientState } from '../router';

interface AuthState {
    email: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        email: null,
        isAuthenticated: false,
        isLoading: true,
    });
    const checkSession = useCallback(async () => {
        try {
            const result = await getSession();
            setState({
                email: result.email,
                isAuthenticated: result.authenticated,
                isLoading: false,
            });
        } catch {
            setState({
                email: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const logout = useCallback(async () => {
        try {
            await logoutFn();
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            resetClientState({ clearSpacetimeToken: true });
            setState({
                email: null,
                isAuthenticated: false,
                isLoading: false,
            });
            if (typeof window !== 'undefined') {
                window.location.replace('/login?fresh=1');
            }
        }
    }, []);

    return {
        ...state,
        logout,
        refetch: checkSession,
    };
}
