import { createFileRoute } from '@tanstack/react-router';
import { AiBoardPage } from '../components/ai/AiBoardPage';

export const Route = createFileRoute('/ai/board')({
    component: AiBoardPage,
});
