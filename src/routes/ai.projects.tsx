import { createFileRoute } from '@tanstack/react-router';
import { AiProjectsPage } from '../components/ai/AiProjectsPage';

export const Route = createFileRoute('/ai/projects')({
    component: AiProjectsPage,
});
