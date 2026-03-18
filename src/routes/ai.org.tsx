import { createFileRoute } from '@tanstack/react-router';
import { AiOrgPage } from '../components/ai/AiOrgPage';

export const Route = createFileRoute('/ai/org')({
    component: AiOrgPage,
});
