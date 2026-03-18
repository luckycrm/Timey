import { createFileRoute } from '@tanstack/react-router';
import { AiWorkspacePage } from '../components/ai/AiWorkspacePage';

export const Route = createFileRoute('/ai/')({
    component: AiWorkspacePage,
});
