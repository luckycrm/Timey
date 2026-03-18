import { createFileRoute } from '@tanstack/react-router';
import { AiSecretsPage } from '../components/ai/AiSecretsPage';

export const Route = createFileRoute('/ai/secrets')({
    component: AiSecretsPage,
});
