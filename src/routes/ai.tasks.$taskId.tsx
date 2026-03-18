import { createFileRoute } from '@tanstack/react-router';
import { AiTaskDetailPage } from '../components/ai/AiTaskDetailPage';

function TaskDetailRoute() {
    const { taskId } = Route.useParams();
    return <AiTaskDetailPage taskId={taskId} />;
}

export const Route = createFileRoute('/ai/tasks/$taskId')({
    component: TaskDetailRoute,
});
