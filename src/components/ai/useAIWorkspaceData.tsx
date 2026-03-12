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
    AiLabel,
    AiLlmProvider,
    AiProject,
    AiRun,
    AiRunEvent,
    AiSecret,
    AiTask,
    AiTaskAttachment,
    AiTaskComment,
    AiTaskLabel,
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
    aiLabels: AiLabel[];
    aiSecrets: AiSecret[];
    aiTaskComments: AiTaskComment[];
    aiTaskLabels: AiTaskLabel[];
    aiTaskAttachments: AiTaskAttachment[];
    aiLlmProviders: AiLlmProvider[];
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

    // Note: .where() generates camelCase column names in SQL (e.g. "orgId") but SpacetimeDB
    // expects snake_case ("org_id"). Subscribe to the full table and filter client-side instead.
    const [allAgents, agentsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_agent : 'skip');
    const [allProjects, projectsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_project : 'skip');
    const [allGoals, goalsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_goal : 'skip');
    const [allTasks, tasksLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_task : 'skip');
    const [allApprovals, approvalsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_approval : 'skip');
    const [allConfigRevisions, configRevisionsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_config_revision : 'skip');
    const [allRuns, runsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_run : 'skip');
    const [allAgentRuntimes, agentRuntimesLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_agent_runtime : 'skip');
    const [allWakeups, wakeupsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_wakeup_request : 'skip');
    const [allRunEvents, runEventsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_run_event : 'skip');
    const [allAdapterSessions, adapterSessionsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_adapter_session : 'skip');
    const [allActivities, activitiesLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_activity : 'skip');
    const [allSettingsRows, settingsLoading] = useSpacetimeDBQuery(aiQuery ? tables.ai_workspace_settings : 'skip');
    const [allLabels] = useSpacetimeDBQuery(aiQuery ? tables.ai_label : 'skip');
    const [allSecrets] = useSpacetimeDBQuery(aiQuery ? tables.ai_secret : 'skip');
    const [allTaskComments] = useSpacetimeDBQuery(aiQuery ? tables.ai_task_comment : 'skip');
    const [allTaskLabels] = useSpacetimeDBQuery(aiQuery ? tables.ai_task_label : 'skip');
    const [allTaskAttachments] = useSpacetimeDBQuery(aiQuery ? tables.ai_task_attachment : 'skip');
    const [allLlmProviders] = useSpacetimeDBQuery(aiQuery ? tables.ai_llm_provider : 'skip');

    const currentOrganization = useMemo(
        () => (currentOrgId == null ? null : allOrganizations.find((org) => org.id === currentOrgId) ?? null),
        [allOrganizations, currentOrgId]
    );

    const members = useMemo(
        () => (currentOrgId == null ? [] : allMemberships.filter((membership) => membership.orgId === currentOrgId)),
        [allMemberships, currentOrgId]
    );

    // Client-side org filter (server sends all rows since tables are public)
    const aiAgents = useMemo(() => currentOrgId == null ? [] : allAgents.filter(r => r.orgId === currentOrgId), [allAgents, currentOrgId]);
    const aiProjects = useMemo(() => currentOrgId == null ? [] : allProjects.filter(r => r.orgId === currentOrgId), [allProjects, currentOrgId]);
    const aiGoals = useMemo(() => currentOrgId == null ? [] : allGoals.filter(r => r.orgId === currentOrgId), [allGoals, currentOrgId]);
    const aiTasks = useMemo(() => currentOrgId == null ? [] : allTasks.filter(r => r.orgId === currentOrgId), [allTasks, currentOrgId]);
    const aiApprovals = useMemo(() => currentOrgId == null ? [] : allApprovals.filter(r => r.orgId === currentOrgId), [allApprovals, currentOrgId]);
    const aiRuns = useMemo(() => currentOrgId == null ? [] : allRuns.filter(r => r.orgId === currentOrgId), [allRuns, currentOrgId]);
    const aiAgentRuntimes = useMemo(() => currentOrgId == null ? [] : allAgentRuntimes.filter(r => r.orgId === currentOrgId), [allAgentRuntimes, currentOrgId]);
    const aiWakeupRequests = useMemo(() => currentOrgId == null ? [] : allWakeups.filter(r => r.orgId === currentOrgId), [allWakeups, currentOrgId]);
    const aiRunEvents = useMemo(() => currentOrgId == null ? [] : allRunEvents.filter(r => r.orgId === currentOrgId), [allRunEvents, currentOrgId]);
    const aiAdapterSessions = useMemo(() => currentOrgId == null ? [] : allAdapterSessions.filter(r => r.orgId === currentOrgId), [allAdapterSessions, currentOrgId]);
    const aiActivities = useMemo(() => currentOrgId == null ? [] : allActivities.filter(r => r.orgId === currentOrgId), [allActivities, currentOrgId]);
    const aiConfigRevisions = useMemo(() => currentOrgId == null ? [] : allConfigRevisions.filter(r => r.orgId === currentOrgId), [allConfigRevisions, currentOrgId]);
    const aiSettings = useMemo(() => currentOrgId == null ? null : (allSettingsRows.find(r => r.orgId === currentOrgId) ?? null), [allSettingsRows, currentOrgId]);
    const aiLabels = useMemo(() => currentOrgId == null ? [] : allLabels.filter(r => r.orgId === currentOrgId), [allLabels, currentOrgId]);
    const aiSecrets = useMemo(() => currentOrgId == null ? [] : allSecrets.filter(r => r.orgId === currentOrgId), [allSecrets, currentOrgId]);
    const aiTaskComments = useMemo(() => currentOrgId == null ? [] : allTaskComments.filter(r => r.orgId === currentOrgId), [allTaskComments, currentOrgId]);
    const aiTaskAttachments = useMemo(() => currentOrgId == null ? [] : allTaskAttachments.filter(r => r.orgId === currentOrgId), [allTaskAttachments, currentOrgId]);
    const aiLlmProviders = useMemo(() => currentOrgId == null ? [] : allLlmProviders.filter(r => r.orgId === currentOrgId), [allLlmProviders, currentOrgId]);

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
        aiConfigRevisions,
        aiRuns,
        aiAgentRuntimes,
        aiAgentRuntimeByAgentId: toAgentRuntimeMap(aiAgentRuntimes),
        aiWakeupRequests,
        aiRunEvents,
        aiAdapterSessions,
        aiActivities,
        aiSettings,
        aiLabels,
        aiSecrets,
        aiTaskComments,
        aiTaskLabels: allTaskLabels,
        aiTaskAttachments,
        aiLlmProviders,
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
