import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AIWorkspaceDataProvider } from '../components/ai/useAIWorkspaceData';

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
