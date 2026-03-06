import { useState, useEffect, useCallback } from 'react';
import { getSession, logout as logoutFn } from '../server/otp';
import { useNavigate } from '@tanstack/react-router';
import { clearStoredToken } from '../router';

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
    const navigate = useNavigate();

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
            clearStoredToken();
            setState({
                email: null,
                isAuthenticated: false,
                isLoading: false,
            });
            navigate({ to: '/login' });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }, [navigate]);

    return {
        ...state,
        logout,
        refetch: checkSession,
    };
}
