# Timey — Project Memory
_Last updated: 2026-03-08_

## Project Overview
Timey is a workplace collaboration and AI agent management platform built on SpacetimeDB. It is porting features from Paperclip (a separate REST-API-based AI agent orchestration product) into a real-time, SpacetimeDB-native architecture. Timey already has a mature chat/messaging system and is extending it with an "AI Workspace" module that mirrors Paperclip's agent/task/goal/cost/inbox/org management features.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript |
| Routing | TanStack Router |
| UI Library | Material UI (MUI v5) for AI workspace; custom chat components elsewhere |
| Backend | SpacetimeDB (TypeScript module) |
| Real-time | SpacetimeDB subscriptions (no polling) |
| SDK | `spacetimedb/tanstack` integration hooks |
| State | SpacetimeDB subscriptions via `useSpacetimeDBQuery` |
| Notifications | sonner (toast) |
| Data Fetching | SpacetimeDB reducers via `useReducer` from `spacetimedb/tanstack` |
| Build | Vite |
| Styling | MUI sx prop + custom theme tokens |

## Key File Paths

### AI Workspace Pages
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AIHomePage.tsx` — Dashboard/home
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiAgentsPage.tsx` — Agent roster list
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiAgentDetailPage.tsx` — Agent detail + runtime config
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiTasksPage.tsx` — Task queue list
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiTaskDetailPage.tsx` — Task detail + runs/wakeups
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiGoalsPage.tsx` — Goals board
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiGoalDetailPage.tsx` — Goal detail
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiCostsPage.tsx` — Cost tracking
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiInboxPage.tsx` — Inbox (approvals/failures/stale)
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiOrgPage.tsx` — Org chart (department/manager views)
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AiSettingsPage.tsx` — AI workspace settings

### AI Workspace Shared Components
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AIPrimitives.tsx` — Base UI: AIWorkspacePage, AISectionCard, AIStatCard, AIStatusPill, AIProgressRow, etc.
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AISidebar.tsx` — Left navigation for AI workspace
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AILiveRunWidget.tsx` — Run status widget with progress/events
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AIRevisionHistoryCard.tsx` — Config revision history
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/AIRuntimeDetailBlocks.tsx` — Runtime config display helpers
- `/Users/lakhwindersingh/Desktop/timey/src/components/ai/useAIWorkspaceData.tsx` — Central data hook for all AI tables

### SpacetimeDB Backend
- `/Users/lakhwindersingh/Desktop/timey/spacetimedb/src/index.ts` — Full schema + all reducers
- `/Users/lakhwindersingh/Desktop/timey/src/module_bindings/` — Generated client bindings (DO NOT EDIT)

### Paperclip Source (reference only)
- `/Users/lakhwindersingh/Desktop/timey/paperclip/ui/src/pages/` — All Paperclip page components
- `/Users/lakhwindersingh/Desktop/timey/paperclip/ui/src/components/` — All Paperclip shared components
- `/Users/lakhwindersingh/Desktop/timey/paperclip/ui/src/adapters/` — 7 adapter config field UIs
- `/Users/lakhwindersingh/Desktop/timey/paperclip/packages/db/src/schema/` — PostgreSQL schema definitions

## SpacetimeDB Tables in Timey

### Core/Auth
- `user` — userId, identity, email, name
- `organization` — orgId, name
- `organization_member` — orgId, userId, role (owner/member)
- `join_id` — invite tokens
- `invite` — pending email invites

### Chat System
- `chat_channel`, `chat_channel_member`, `chat_message`, `chat_reaction`, `chat_read_state`, `chat_typing`

### Video/Meetings
- `chat_call_session`, `chat_call_participant`, `chat_scheduled_meeting`
- `meeting_public_profile`, `meeting_event_type`, `meeting_availability_rule`
- `meeting_booking`, `meeting_recording_policy`, `meeting_followup_template`, `meeting_reminder_template`, `meeting_reminder_delivery`, `meeting_activity`

### AI Workspace (14 tables)
- `ai_agent` — Agent roster (name, role, department, status, autonomy/approval modes, tools, schedule, budget)
- `ai_agent_runtime` — Agent execution config (adapter_type, base_url, command, cwd, env_json, config_json, policy jsons)
- `ai_project` — Projects/workstreams
- `ai_goal` — Goals with progress tracking
- `ai_task` — Tasks/work items assigned to agents
- `ai_approval` — Human approval requests
- `ai_run` — Execution runs with token/cost tracking
- `ai_wakeup_request` — Queued wakeup requests to trigger agent runs
- `ai_run_event` — Granular events within a run
- `ai_adapter_session` — External adapter session tracking
- `ai_config_revision` — Audit trail for config changes
- `ai_activity` — Workspace activity log
- `ai_workspace_settings` — Global AI policy config (1 row per org)

### Presence
- `user_presence` — User online status

## Important Patterns and Conventions

### Data Access Pattern
```typescript
// All AI data comes from one central hook
const { aiAgents, aiTasks, aiRuns, currentOrgId, ... } = useAIWorkspaceData();

// Subscriptions use where() for org filtering
const [rows, isLoading] = useSpacetimeDBQuery(
  aiQuery ? tables.ai_task.where(row => row.orgId.eq(currentOrgId)) : 'skip'
);
```

### Reducer Call Pattern
```typescript
const createAiTask = useReducer(reducers.createAiTask);
// Then call with object syntax (NOT positional args)
await createAiTask({ orgId: currentOrgId, title: '...', ... });
```

### NONE_U64 Sentinel
```typescript
const NONE_U64 = 18446744073709551615n; // u64 max = null equivalent
// Always check before using as real ID:
if (agent.managerUserId === NONE_U64) { /* no manager */ }
```

### BigInt Handling
- All u64 fields are JavaScript BigInt
- Display: `value.toString()` or `Number(value)` (safe for timestamps)
- Arithmetic: `value + 1n` (not `+ 1`)
- Comparisons: `value === NONE_U64` (not `=== undefined`)
- Cost display: `microusdToUsd(bigintValue)` from `./aiUtils`

### Timestamp Handling
- All timestamps are `u64` milliseconds since epoch
- Display: `new Date(Number(value))` is correct for Timey's u64 timestamps
- NOTE: SpacetimeDB docs say microseconds, but Timey code uses `new Date(Number(value))` directly without `/1000n` division — verify actual units in reducers

### Cost Units
- Agent budget: `daily_budget_microusd` (u64 microusd = millionths of USD)
- Run cost: `cost_microusd` (u64 microusd)
- Workspace guardrail: `max_run_cost_microusd`
- Display: `microusdToUsd(value)` converts to float USD; `formatUsd(float)` formats

### Page Layout Pattern
All AI workspace pages use:
```tsx
<AIWorkspacePage page="tasks">
  <AIPageIntro eyebrow="..." title="..." description="..." />
  <AIStatGrid>
    <AIStatCard label="..." value="..." tone="success|warning|danger|info|neutral" />
  </AIStatGrid>
  <AISectionGrid>
    <AISectionCard eyebrow="..." title="..." description="...">
      {/* content */}
    </AISectionCard>
  </AISectionGrid>
</AIWorkspacePage>
```

### Navigation
- AI workspace routes: `/ai`, `/ai/agents`, `/ai/tasks`, `/ai/goals`, `/ai/costs`, `/ai/inbox`, `/ai/org`, `/ai/settings`, `/ai/approvals`, `/ai/activity`, `/ai/projects`
- Agent detail: `/ai/agents/:agentId`
- Task detail: `/ai/tasks/:taskId`
- Goal detail: `/ai/goals/:goalId`

## Gotchas and Critical Rules

### Bug: AiInboxPage.tsx tab variable (line 198-199)
The `tab` variable is referenced in `AiInboxPage.tsx` at line 198 (`const baseRows = tab === 'new' ...`) but `tab` is never declared in the component. This will throw a ReferenceError at runtime. The "new/all" tab filter is non-functional.

### Paperclip vs Timey Architecture Difference
Paperclip agents = process runners (adapter type + config → runs processes). Timey agents = roster entries (department, role, tools list). The `ai_agent_runtime` table bridges this but it's a separate record, not part of the agent definition. When implementing Paperclip features that rely on `agent.adapterType` or `agent.adapterConfig`, use `ai_agent_runtime` in Timey.

### No Comments System
Timey has NO comment infrastructure for tasks. `CommentThread` is a core Paperclip component that requires: new `ai_task_comment` table, reducers for CRUD, and a markdown editor with @mention support.

### No Log Streaming
Timey has no equivalent to Paperclip's `logStore`/`logRef` log storage. `ai_run_event` is the closest analog (structured events), but not raw stdout/stderr.

### Adapter Config Forms
Paperclip has 7 dedicated adapter config components with specific field UIs. Timey's agent runtime form uses raw JSON blobs (`env_json`, `config_json`) with a single adapter_type dropdown. When porting adapter-specific configs, each adapter needs its own field set.

### SpacetimeDB-Specific Rules
1. Never edit `/src/module_bindings/` — regenerate with `spacetime generate`
2. Reducers are transactional — no return values to caller, no HTTP/network, no filesystem
3. Use `0n` placeholder for autoInc PKs on insert
4. Index names are used verbatim (no camelCase transformation)
5. Multi-column index `.filter()` is broken — use single-column + manual filter
