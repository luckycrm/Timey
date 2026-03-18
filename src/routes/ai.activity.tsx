import { createFileRoute } from '@tanstack/react-router';
import { AiActivityPage } from '../components/ai/AiActivityPage';

export const Route = createFileRoute('/ai/activity')({
    component: AiActivityPage,
});
