import { createFileRoute } from '@tanstack/react-router';
import { AiGoalDetailPage } from '../components/ai/AiGoalDetailPage';

function GoalDetailRoute() {
    const { goalId } = Route.useParams();
    return <AiGoalDetailPage goalId={goalId} />;
}

export const Route = createFileRoute('/ai/goals/$goalId')({
    component: GoalDetailRoute,
});
