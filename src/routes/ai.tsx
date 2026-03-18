import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AIWorkspaceDataProvider } from '../components/ai/useAIWorkspaceData.tsx';

function AIRouteLayout() {
    return (
        <AIWorkspaceDataProvider>
            <Outlet />
        </AIWorkspaceDataProvider>
    );
}

export const Route = createFileRoute('/ai')({
    component: AIRouteLayout,
});
