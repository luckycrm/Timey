import { createFileRoute } from '@tanstack/react-router';
import { MeetingActivityPage } from '../components/meetings/MeetingActivityPage';

export const Route = createFileRoute('/meetings/activity')({
    component: MeetingActivityPage,
});
