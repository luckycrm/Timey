import { createFileRoute } from '@tanstack/react-router';
import { MeetingCalendarPage } from '../components/meetings/MeetingCalendarPage';

export const Route = createFileRoute('/meetings/calendar')({
    component: MeetingCalendarPage,
});
