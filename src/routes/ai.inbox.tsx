import { createFileRoute } from '@tanstack/react-router';
import { AiInboxPage } from '../components/ai/AiInboxPage';

export const Route = createFileRoute('/ai/inbox')({
    component: AiInboxPage,
});
