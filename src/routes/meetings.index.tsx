import { createFileRoute } from '@tanstack/react-router';
import { MeetingManagerPage } from '../components/meetings/MeetingManagerPage';

export const Route = createFileRoute('/meetings/')({
    component: MeetingManagerPage,
});
