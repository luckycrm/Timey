import { createFileRoute } from '@tanstack/react-router';
import { AiLlmProvidersPage } from '../components/ai/AiLlmProvidersPage';

export const Route = createFileRoute('/ai/llms')({
    component: AiLlmProvidersPage,
});
