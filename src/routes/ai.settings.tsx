import { createFileRoute } from '@tanstack/react-router';
import { AiSettingsPage } from '../components/ai/AiSettingsPage';

export const Route = createFileRoute('/ai/settings')({
    component: AiSettingsPage,
});
