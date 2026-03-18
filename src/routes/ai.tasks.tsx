import { createFileRoute } from '@tanstack/react-router';
import { AiTasksPage } from '../components/ai/AiTasksPage';

export const Route = createFileRoute('/ai/tasks')({
    component: AiTasksPage,
});
