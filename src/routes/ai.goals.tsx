import { createFileRoute } from '@tanstack/react-router';
import { AiGoalsPage } from '../components/ai/AiGoalsPage';

export const Route = createFileRoute('/ai/goals')({
    component: AiGoalsPage,
});
