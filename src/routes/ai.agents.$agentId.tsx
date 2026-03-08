import { createFileRoute } from '@tanstack/react-router';
import { AiAgentDetailPage } from '../components/ai/AiAgentDetailPage';

function AgentDetailRoute() {
    const { agentId } = Route.useParams();
    return <AiAgentDetailPage agentId={agentId} />;
}

export const Route = createFileRoute('/ai/agents/$agentId')({
    component: AgentDetailRoute,
});
