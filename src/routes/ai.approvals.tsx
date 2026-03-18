import { createFileRoute } from '@tanstack/react-router';
import { AiApprovalsPage } from '../components/ai/AiApprovalsPage';

export const Route = createFileRoute('/ai/approvals')({
    component: AiApprovalsPage,
});
