import { createFileRoute } from '@tanstack/react-router';
import { MeetingSettingsPage } from '../components/meetings/MeetingSettingsPage';

export const Route = createFileRoute('/meetings/settings')({
    component: MeetingSettingsPage,
});
