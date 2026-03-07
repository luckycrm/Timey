import { createFileRoute } from '@tanstack/react-router';
import { PublicMeetingInvitePage } from '../components/meetings/PublicMeetingInvitePage';

export const Route = createFileRoute('/meet/$inviteToken')({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    return <PublicMeetingInvitePage inviteToken={params.inviteToken} />;
}
