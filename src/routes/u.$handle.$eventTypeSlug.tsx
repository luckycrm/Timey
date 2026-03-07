import { createFileRoute } from '@tanstack/react-router';
import { PublicBookingEventPage } from '../components/meetings/PublicBookingEventPage';

export const Route = createFileRoute('/u/$handle/$eventTypeSlug')({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    return <PublicBookingEventPage handle={params.handle} eventTypeSlug={params.eventTypeSlug} />;
}
