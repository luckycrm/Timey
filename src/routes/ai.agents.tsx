import { createFileRoute } from '@tanstack/react-router';
import { AiAgentsPage } from '../components/ai/AiAgentsPage';

export const Route = createFileRoute('/ai/agents')({
    component: AiAgentsPage,
});
