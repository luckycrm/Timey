import { createFileRoute } from '@tanstack/react-router';
import { MembersPage } from '../components/members/MembersPage';

export const Route = createFileRoute('/members')({
    component: MembersPage,
});
