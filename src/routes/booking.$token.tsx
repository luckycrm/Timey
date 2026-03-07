import { createFileRoute } from '@tanstack/react-router';
import { PublicBookingManagePage } from '../components/meetings/PublicBookingManagePage';

export const Route = createFileRoute('/booking/$token')({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    return <PublicBookingManagePage token={params.token} />;
}
