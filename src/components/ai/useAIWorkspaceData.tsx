import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSpacetimeDB, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { tables } from '../../module_bindings';
import type {
    AiActivity,
    AiAdapterSession,
    AiAgent,
    AiConfigRevision,
    AiAgentRuntime,
    AiApproval,
    AiGoal,
    AiProject,
    AiRun,
    AiRunEvent,
    AiTask,
    AiWakeupRequest,
    AiWorkspaceSettings,
    Organization,
    OrganizationMember,
    User,
} from '../../module_bindings/types';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationMembership } from '../../hooks/useOrganizationMembership';

function toMap<T extends { id: bigint }>(rows: T[]) {
    return new Map(rows.map((row) => [row.id, row]));
}

function toAgentRuntimeMap<T extends { agentId: bigint }>(rows: T[]) {
    return new Map(rows.map((row) => [row.agentId, row]));
}

export interface AIWorkspaceData {
    authLoading: boolean;
    isAuthenticated: boolean;
    isCheckingMembership: boolean;
    membershipUnavailable: boolean;
    loading: boolean;
    currentUser: User | null;
    currentOrgId: bigint | null;
    currentOrganization: Organization | null;
    effectiveOrgName: string;
    currentMembership: OrganizationMember | null;
    isOwner: boolean;
    users: User[];
    usersById: Map<bigint, User>;
    members: OrganizationMember[];
    aiAgents: AiAgent[];
    aiProjects: AiProject[];
    aiGoals: AiGoal[];
    aiTasks: AiTask[];
    aiApprovals: AiApproval[];
    aiConfigRevisions: AiConfigRevision[];
    aiRuns: AiRun[];
    aiAgentRuntimes: AiAgentRuntime[];
    aiAgentRuntimeByAgentId: Map<bigint, AiAgentRuntime>;
    aiWakeupRequests: AiWakeupRequest[];
    aiRunEvents: AiRunEvent[];
    aiAdapterSessions: AiAdapterSession[];
    aiActivities: AiActivity[];
    aiSettings: AiWorkspaceSettings | null;
}

const AIWorkspaceDataContext = createContext<AIWorkspaceData | null>(null);

function useAIWorkspaceDataSource(enabled: boolean): AIWorkspaceData {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { identity, isActive } = useSpacetimeDB();
    const {
        memberships,
        isCheckingMembership,
        membershipUnavailable,
    } = useOrganizationMembership({ enabled: enabled && isAuthenticated });

    const shouldQuery = enabled && isAuthenticated && isActive;

    const [allUsers, usersLoading] = useSpacetimeDBQuery(shouldQuery ? tables.user : 'skip');
    const [allOrganizations, orgsLoading] = useSpacetimeDBQuery(shouldQuery ? tables.organization : 'skip');
    const [allMemberships, membershipsLoading] = useSpacetimeDBQuery(shouldQuery ? tables.organization_member : 'skip');

    const currentUser = useMemo(
        () => (identity == null ? null : allUsers.find((user) => user.identity.isEqual(identity)) ?? null),
        [allUsers, identity]
    );

    const currentMembership = memberships[0] ?? null;
    const currentOrgId = currentMembership?.orgId ?? null;
    const aiQuery = shouldQuery && currentOrgId != null;
    const [allAgents, agentsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_agent.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allProjects, projectsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_project.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allGoals, goalsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_goal.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allTasks, tasksLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_task.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allApprovals, approvalsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_approval.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allConfigRevisions, configRevisionsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_config_revision.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allRuns, runsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_run.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allAgentRuntimes, agentRuntimesLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_agent_runtime.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allWakeups, wakeupsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_wakeup_request.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allRunEvents, runEventsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_run_event.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allAdapterSessions, adapterSessionsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_adapter_session.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allActivities, activitiesLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_activity.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const [allSettingsRows, settingsLoading] = useSpacetimeDBQuery(
        aiQuery ? tables.ai_workspace_settings.where((row) => row.orgId.eq(currentOrgId)) : 'skip'
    );
    const currentOrganization = useMemo(
        () => (currentOrgId == null ? null : allOrganizations.find((org) => org.id === currentOrgId) ?? null),
        [allOrganizations, currentOrgId]
    );

    const members = useMemo(
        () => (currentOrgId == null ? [] : allMemberships.filter((membership) => membership.orgId === currentOrgId)),
        [allMemberships, currentOrgId]
    );

    const aiAgents = allAgents;
    const aiProjects = allProjects;
    const aiGoals = allGoals;
    const aiTasks = allTasks;
    const aiApprovals = allApprovals;
    const aiRuns = allRuns;
    const aiAgentRuntimes = allAgentRuntimes;
    const aiWakeupRequests = allWakeups;
    const aiRunEvents = allRunEvents;
    const aiAdapterSessions = allAdapterSessions;
    const aiActivities = allActivities;
    const aiSettings = allSettingsRows[0] ?? null;

    const loading =
        authLoading ||
        (enabled &&
            (
                isCheckingMembership ||
                usersLoading ||
                orgsLoading ||
                membershipsLoading ||
                agentsLoading ||
                projectsLoading ||
                goalsLoading ||
                tasksLoading ||
                approvalsLoading ||
                configRevisionsLoading ||
                runsLoading ||
                agentRuntimesLoading ||
                wakeupsLoading ||
                runEventsLoading ||
                adapterSessionsLoading ||
                activitiesLoading ||
                settingsLoading
            ));

    return {
        authLoading,
        isAuthenticated,
        isCheckingMembership,
        membershipUnavailable,
        loading,
        currentUser,
        currentOrgId,
        currentOrganization,
        effectiveOrgName: currentOrganization?.name ?? 'Timey',
        currentMembership,
        isOwner: currentMembership?.role === 'owner',
        users: allUsers,
        usersById: toMap(allUsers),
        members,
        aiAgents,
        aiProjects,
        aiGoals,
        aiTasks,
        aiApprovals,
        aiConfigRevisions: allConfigRevisions,
        aiRuns,
        aiAgentRuntimes,
        aiAgentRuntimeByAgentId: toAgentRuntimeMap(allAgentRuntimes),
        aiWakeupRequests,
        aiRunEvents,
        aiAdapterSessions,
        aiActivities,
        aiSettings,
    };
}

export function AIWorkspaceDataProvider({ children }: { children: ReactNode }) {
    const data = useAIWorkspaceDataSource(true);
    return <AIWorkspaceDataContext.Provider value={data}>{children}</AIWorkspaceDataContext.Provider>;
}

export function useAIWorkspaceData(): AIWorkspaceData {
    const context = useContext(AIWorkspaceDataContext);
    if (context == null) {
        throw new Error('useAIWorkspaceData must be used within AIWorkspaceDataProvider');
    }
    return context;
}
