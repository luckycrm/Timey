import { createFileRoute } from '@tanstack/react-router';
import { AiProjectDetailPage } from '../components/ai/AiProjectDetailPage';

function ProjectDetailRoute() {
    const { projectId } = Route.useParams();
    return <AiProjectDetailPage projectId={projectId} />;
}

export const Route = createFileRoute('/ai/projects/$projectId')({
    component: ProjectDetailRoute,
});
