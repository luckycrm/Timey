import { createFileRoute } from '@tanstack/react-router';
import { AiApprovalDetailPage } from '../components/ai/AiApprovalDetailPage';

function ApprovalDetailRoute() {
    const { approvalId } = Route.useParams();
    return <AiApprovalDetailPage approvalId={approvalId} />;
}

export const Route = createFileRoute('/ai/approvals/$approvalId')({
    component: ApprovalDetailRoute,
});
