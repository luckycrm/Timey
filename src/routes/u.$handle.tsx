import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/u/$handle')({
    component: RouteComponent,
});

function RouteComponent() {
    return <Outlet />;
}
