import { createFileRoute } from '@tanstack/react-router';
import { AiCostsPage } from '../components/ai/AiCostsPage';

export const Route = createFileRoute('/ai/costs')({
    component: AiCostsPage,
});
