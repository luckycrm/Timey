import { createFileRoute } from '@tanstack/react-router';
import { PublicBookingDirectoryPage } from '../components/meetings/PublicBookingDirectoryPage';

export const Route = createFileRoute('/u/$handle/')({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    return <PublicBookingDirectoryPage handle={params.handle} />;
}
