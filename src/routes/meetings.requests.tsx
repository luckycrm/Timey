import { createFileRoute } from '@tanstack/react-router';
import { MeetingRequestsPage } from '../components/meetings/MeetingRequestsPage';

export const Route = createFileRoute('/meetings/requests')({
    component: MeetingRequestsPage,
});
