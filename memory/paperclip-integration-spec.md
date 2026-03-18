# Paperclip Integration Spec — Master Validation Document
_Generated: 2026-03-08_

---

## Section A — Data Schema Comparison

### A1. `agents` table (Paperclip PostgreSQL → Timey SpacetimeDB `ai_agent`)

| Paperclip Column | Type | Timey Equivalent | Notes |
|---|---|---|---|
| id | uuid PK | id (u64 autoInc PK) | Type mismatch: UUID vs u64 |
| companyId | uuid FK | org_id (u64) | Renamed: company → org |
| name | text | name (string) | Match |
| role | text | role (string) | Match |
| title | text | **MISSING** | No `title` field in Timey |
| icon | text | **MISSING** | No `icon` field in Timey |
| status | text | status (string) | Match but different values (active/running/idle/paused/error/terminated vs draft/active/paused/attention) |
| reportsTo | uuid FK (self) | **MISSING** | No parent-agent hierarchy; Timey uses manager_user_id (human users only) |
| capabilities | text | **MISSING** | No `capabilities` field |
| adapterType | text | **MISSING** | Not in ai_agent; partial coverage via ai_agent_runtime.adapter_type |
| adapterConfig | jsonb | **MISSING** | Not in ai_agent; partial coverage via ai_agent_runtime.config_json |
| runtimeConfig | jsonb | heartbeat_policy_json + wake_policy_json | Different structure |
| budgetMonthlyCents | integer | daily_budget_microusd (u64) | Different: monthly cents vs daily microusd |
| spentMonthlyCents | integer | **MISSING** | Not tracked |
| permissions | jsonb | **MISSING** | No permissions field |
| lastHeartbeatAt | timestamp | last_heartbeat_at (u64) in ai_agent_runtime | Moved to runtime table |
| metadata | jsonb | **MISSING** | No metadata |
| createdAt | timestamp | created_at (u64) | Match (type differs) |
| updatedAt | timestamp | updated_at (u64) | Match (type differs) |

**Timey-only fields in ai_agent:** department, description, autonomy_mode, approval_mode, tools_json, schedule_json, owner_user_id, manager_user_id, project_id

**Summary:** Timey's `ai_agent` is a fundamentally different model. Paperclip agents are process-runners with adapter config; Timey agents are roster entries with business metadata. Key missing: adapter system (type/config), hierarchy (reportsTo), agent-level permissions, icon.

---

### A2. `issues` table (Paperclip PostgreSQL → Timey SpacetimeDB `ai_task`)

| Paperclip Column | Type | Timey Equivalent | Notes |
|---|---|---|---|
| id | uuid PK | id (u64 autoInc PK) | Type mismatch |
| companyId | uuid FK | org_id (u64) | Renamed |
| projectId | uuid FK | project_id (u64) | Match |
| goalId | uuid FK | goal_id (u64) | Match |
| parentId | uuid FK (self) | **MISSING** | No sub-task hierarchy in Timey |
| title | text | title (string) | Match |
| description | text | description (string) | Match |
| status | text | status (string) | Different values: backlog/todo/in_progress/in_review/blocked/done/cancelled vs queued/running/waiting_approval/blocked/completed/failed/cancelled |
| priority | text | priority (string) | Different values: low/medium/high/urgent vs low/normal/high/urgent |
| assigneeAgentId | uuid FK | agent_id (u64) | Match (renamed) |
| assigneeUserId | text | created_by_user_id (u64) | MISMATCH — Timey tracks creator, not user assignee |
| checkoutRunId | uuid FK | **MISSING** | No checkout concept |
| executionRunId | uuid FK | **MISSING** (partial via ai_run.task_id) | Indirect via runs |
| executionAgentNameKey | text | **MISSING** | |
| executionLockedAt | timestamp | **MISSING** | |
| createdByAgentId | uuid FK | **MISSING** | |
| createdByUserId | text | created_by_user_id (u64) | Partially covered |
| issueNumber | integer | **MISSING** | No sequential numbering |
| identifier | text | **MISSING** | No human-readable identifier (e.g. "ENG-123") |
| requestDepth | integer | **MISSING** | |
| billingCode | text | **MISSING** | |
| assigneeAdapterOverrides | jsonb | **MISSING** | |
| startedAt | timestamp | **MISSING** | (started_at exists on ai_run, not ai_task) |
| completedAt | timestamp | completed_at (u64) | Match |
| cancelledAt | timestamp | **MISSING** | |
| hiddenAt | timestamp | **MISSING** | |
| createdAt | timestamp | created_at (u64) | Match |
| updatedAt | timestamp | updated_at (u64) | Match |

**Timey-only fields in ai_task:** source_type, linked_entity_type, linked_entity_id, due_at

**Critical Gaps:** No sub-task hierarchy, no identifier/issue number, no assigneeUserId (only agent-assignee), no billing code, no hidden/cancelled timestamps, different status vocabulary.

---

### A3. `goals` table (Paperclip PostgreSQL → Timey SpacetimeDB `ai_goal`)

| Paperclip Column | Type | Timey Equivalent | Notes |
|---|---|---|---|
| id | uuid PK | id (u64 autoInc PK) | Type mismatch |
| companyId | uuid FK | org_id (u64) | Renamed |
| title | text | title (string) | Match |
| description | text | description (string) | Match |
| level | text | **MISSING** | Paperclip has mission/objective/task levels |
| status | text | status (string) | Different: planned/in_progress/completed vs on_track/watching/blocked/completed |
| parentId | uuid FK (self) | **MISSING** | No goal hierarchy in Timey |
| ownerAgentId | uuid FK | owner_user_id (u64) | Mismatch: Paperclip assigns agents as owners, Timey assigns users |
| createdAt | timestamp | created_at (u64) | Match |
| updatedAt | timestamp | updated_at (u64) | Match |

**Timey-only fields in ai_goal:** progress_pct, project_id, due_at

**Critical Gaps:** No goal hierarchy (parentId), no level field (mission/objective/task), owner is user not agent.

---

### A4. `projects` table (Paperclip PostgreSQL → Timey SpacetimeDB `ai_project`)

| Paperclip Column | Type | Timey Equivalent | Notes |
|---|---|---|---|
| id | uuid PK | id (u64 autoInc PK) | Type mismatch |
| companyId | uuid FK | org_id (u64) | Renamed |
| goalId | uuid FK | **MISSING** | No direct goal link; Timey goals reference project_id |
| name | text | name (string) | Match |
| description | text | summary (string) | Renamed |
| status | text | status (string) | Different values |
| leadAgentId | uuid FK | **MISSING** | No lead agent |
| targetDate | date | **MISSING** | No target date |
| color | text | **MISSING** | No color field |
| archivedAt | timestamp | **MISSING** | No archive tracking |
| createdAt | timestamp | created_at (u64) | Match |
| updatedAt | timestamp | updated_at (u64) | Match |

**Critical Gaps:** No color, targetDate, archivedAt, leadAgentId, goalId link.

---

### A5. `heartbeat_runs` table (Paperclip PostgreSQL → Timey SpacetimeDB `ai_run`)

| Paperclip Column | Type | Timey Equivalent | Notes |
|---|---|---|---|
| id | uuid PK | id (u64 autoInc PK) | Type mismatch |
| companyId | uuid FK | org_id (u64) | Renamed |
| agentId | uuid FK | agent_id (u64) | Match |
| invocationSource | text | trigger_type (string) | Renamed |
| triggerDetail | text | **MISSING** | |
| status | text | status (string) | Values differ slightly |
| startedAt | timestamp | started_at (u64) | Match |
| finishedAt | timestamp | finished_at (u64) | Match |
| error | text | error_message (string) | Renamed |
| wakeupRequestId | uuid FK | **MISSING** (via ai_wakeup_request.run_id) | Indirect link |
| exitCode | integer | **MISSING** | |
| signal | text | **MISSING** | |
| usageJson | jsonb | token_input + token_output + tool_calls (u64s) | Normalized into separate columns |
| resultJson | jsonb | **MISSING** | |
| sessionIdBefore/After | text | **MISSING** | |
| logStore/Ref/Bytes/Sha/Compressed | various | **MISSING** | No log storage system |
| stdoutExcerpt | text | **MISSING** | |
| stderrExcerpt | text | **MISSING** | |
| errorCode | text | **MISSING** | |
| externalRunId | text | **MISSING** | |
| contextSnapshot | jsonb | **MISSING** | |
| createdAt | timestamp | created_at (u64) | Match |
| updatedAt | timestamp | updated_at (u64) | Match |

**Timey-only:** summary, cost_microusd

**Critical Gaps:** No log system, no stdout/stderr excerpts, no errorCode, no contextSnapshot (used by Paperclip Inbox for issue-run linking), no exitCode/signal.

---

### A6. `cost_events` table (Paperclip PostgreSQL → Timey SpacetimeDB)

Paperclip uses a dedicated `cost_events` table with: id, companyId, agentId, issueId, projectId, goalId, billingCode, provider, model, inputTokens, outputTokens, costCents, occurredAt, createdAt.

**Timey equivalent:** No dedicated cost_events table. Cost data is embedded in `ai_run` (cost_microusd, token_input, token_output). The `ai_workspace_settings` table has max_run_cost_microusd guardrail.

**Critical Gap:** No separate cost ledger, no per-event provider/model tracking, no billing codes, no issue/goal attribution of costs. Timey computes costs from runs, not from discrete events.

---

### A7. Timey-only tables (no Paperclip equivalent)

- `ai_agent_runtime` — separates runtime config from agent definition
- `ai_wakeup_request` — explicit wakeup queue
- `ai_run_event` — granular per-run events
- `ai_adapter_session` — adapter session tracking
- `ai_config_revision` — configuration audit trail
- `ai_activity` — workspace activity log
- `ai_workspace_settings` — global AI workspace config
- `ai_approval` — approval workflow
- Full chat system: chat_channel, chat_message, chat_reaction, chat_read_state, chat_typing
- Video call system: chat_call_session, chat_call_participant, chat_scheduled_meeting
- Meeting scheduling: meeting_booking, meeting_event_type, meeting_availability_rule, etc.
- Presence: user_presence

---

## Section B — Feature Parity Checklist

### B1. Issues / Tasks Page (Paperclip: Issues.tsx → Timey: AITasksPage.tsx)

- [x] List of tasks/issues with priority sorting
- [x] Status filtering (open/in-motion/blocked/waiting)
- [x] Create new task inline form
- [x] Link task to project/goal/agent
- [x] Task status update (start/complete)
- [x] Approval request from task row
- [ ] Kanban/board view (drag-and-drop between status columns) — Paperclip has KanbanBoard with dnd-kit; Timey has NO kanban view
- [ ] List/kanban toggle — Paperclip switches between list and board; Timey list-only
- [ ] Search/filter by text (q= URL param) — Paperclip has debounced search; Timey missing
- [ ] Filter by assignee — Paperclip supports ?assignee= URL param; Timey missing
- [ ] Live run indicator badges on task rows — Paperclip shows live run pulse; Timey shows pill badges only
- [ ] Sub-task hierarchy (parentId) — Paperclip shows child issues on IssueDetail; Timey has no parent/child
- [ ] Issue identifier (ENG-123 style) — Paperclip has identifier field; Timey missing
- [ ] Inline status change on list row — Paperclip has quick-edit; Timey requires navigation to task detail

### B2. Issue / Task Detail Page (Paperclip: IssueDetail.tsx → Timey: AITaskDetailPage.tsx)

- [x] View task metadata (title, description, project, goal, agent, priority, status)
- [x] Start / complete / request approval actions
- [x] Wakeup queue — create and list wakeups
- [x] Run history with cost/token display
- [x] Adapter session list
- [x] Run events feed
- [x] Live run widget
- [ ] Comment thread — Paperclip has full CommentThread with markdown; Timey has NO comments
- [ ] Inline editing of title/description — Paperclip uses InlineEditor component; Timey shows static text
- [ ] Attachments — Paperclip has attachment upload/list; Timey has no attachments
- [ ] Activity feed — Paperclip shows full activity timeline; Timey shows run events only (not broader activity)
- [ ] Approval list with approve/reject buttons — Paperclip has ApprovalCard component; Timey shows pending approval badge only
- [ ] Issue cost summary (tokens + USD across all runs) — Paperclip computes per-issue totals; Timey individual run costs only
- [ ] Mark as read — Paperclip tracks unread state; Timey has no read state
- [ ] Linked heartbeat runs sidebar — Paperclip shows sidebar; Timey shows flat list
- [ ] Properties panel (side panel) — Paperclip has collapsible PropertiesPanel; Timey uses inline card layout

### B3. Agents Page (Paperclip: Agents.tsx → Timey: AIAgentsPage.tsx)

- [x] List view of all agents with status
- [x] Agent status filter (active/paused/draft)
- [x] Create new agent inline
- [x] Pause/activate agent
- [x] Link agent to project
- [x] Runtime attachment display
- [ ] Org chart / tree view — Paperclip has full org tree with depth indentation and live run links; Timey org view is on a separate dedicated page (AIOrgPage) but uses department/manager grouping (different concept)
- [ ] Show adapter type per agent row — Paperclip shows adapter label on each row; Timey shows adapter only in detail
- [ ] Last heartbeat relative time — Paperclip shows "3m ago" per row; Timey missing from list
- [ ] Filter by error/terminated — Paperclip has "Error" tab and "Show terminated" toggle; Timey has "attention" status only
- [ ] Live run indicator per agent row — Paperclip shows pulsing link; Timey shows wakeup count badge
- [ ] Icon picker — Paperclip has AgentIconPicker; Timey has no icon

### B4. Agent Detail Page (Paperclip: AgentDetail.tsx → Timey: AIAgentDetailPage.tsx)

- [x] Three views: overview, configure, runs (Paperclip); Timey has runtime config form + wakeup + run history
- [x] Runtime adapter configuration (adapter type, base URL, command, etc.)
- [x] Invoke/pause/resume/terminate agent actions (partially — Timey activate/pause only)
- [x] Run history list with status/cost
- [x] Wakeup queue management
- [x] Configuration revision history (AIRevisionHistoryCard)
- [x] Live run widget
- [ ] Terminate agent action — Paperclip has terminate; Timey missing
- [ ] Resume from paused — Paperclip has resume; Timey only has activate
- [ ] Breadcrumbs — Paperclip has full breadcrumb trail; Timey missing
- [ ] Reset session — Paperclip has resetSession mutation; Timey missing
- [ ] Update permissions (canCreateAgents) — Paperclip has permission toggle; Timey missing
- [ ] Claude login flow — Paperclip has OAuth-style claude login; Timey missing
- [ ] Full log viewer with stdout/stderr — Paperclip streams live logs; Timey has no log viewer
- [ ] Run detail view with transcript — Paperclip builds full transcript from events; Timey has summary-level run list
- [ ] Env variable display with secret redaction — Paperclip redacts API keys, JWT tokens; Timey uses envJson blob
- [ ] Charts (run activity, priority, issue status, success rate) — Paperclip shows 4 charts; Timey missing charts
- [ ] Assigned issues list — Paperclip shows issues assigned to agent; Timey shows tasks (same concept, but misses parentId/sub-issues)

### B5. Goals Page (Paperclip: Goals.tsx → Timey: AIGoalsPage.tsx)

- [x] List/board of goals with status grouping
- [x] Create new goal
- [x] Goal status (on_track/watching/blocked/completed)
- [x] Progress percentage display and bar
- [x] Link to project
- [x] Linked task counts
- [ ] Goal hierarchy (parentId / sub-goals) — Paperclip shows GoalTree with child goals; Timey has no parent goal concept
- [ ] Level field (mission/objective/task) — Paperclip has level; Timey missing
- [ ] Owner agent (not user) — Paperclip assigns agent as owner; Timey assigns user as owner
- [ ] Goal tree visualization — Paperclip has GoalTree component; Timey has flat board

### B6. Goal Detail Page (Paperclip: GoalDetail.tsx → Timey: AIGoalDetailPage.tsx)

- [x] View goal metadata
- [x] Advance progress action
- [x] Linked tasks display
- [x] Status badge
- [ ] Inline title/description editing — Paperclip uses InlineEditor; Timey is read-only
- [ ] Sub-goals tab — Paperclip shows child goals with add button; Timey missing
- [ ] Linked projects tab — Paperclip shows projects with navigate; Timey only shows project name
- [ ] Image upload for description — Paperclip has imageUploadHandler; Timey missing
- [ ] Properties panel (side panel) — Paperclip has GoalProperties in a panel; Timey inline

### B7. Costs Page (Paperclip: Costs.tsx → Timey: AICostsPage.tsx)

- [x] Date range presets (mtd/7d/30d/ytd/all)
- [x] Total spend for range
- [x] Spend breakdown by agent
- [x] Spend breakdown by project
- [x] 7-day trend chart (bar)
- [x] Budget progress bar (run guardrail)
- [ ] Custom date range picker — Paperclip has from/to date inputs; Timey missing
- [ ] Budget utilization % — Paperclip shows % of monthly budget; Timey shows run guardrail only
- [ ] Per-agent run type breakdown (api runs vs subscription runs) — Paperclip shows api/subscription split; Timey missing
- [ ] Token breakdown (input/output) per agent — Paperclip shows in/out tokens; Timey shows token totals from runs
- [ ] "By Project" via direct cost attribution — Paperclip uses cost_events.projectId; Timey proxies via agent→project
- [ ] Cost events as ledger — Paperclip has discrete cost_events; Timey has costs embedded in runs only

### B8. Inbox Page (Paperclip: Inbox.tsx → Timey: AIInboxPage.tsx)

- [x] Pending approvals section
- [x] Failed runs section
- [x] Stale tasks section
- [x] Blocked tasks section
- [x] Failed wakeups section
- [x] Runtime errors section
- [x] Row-level navigation to task/agent
- [ ] New/All tab filter — Paperclip has "new" and "all" tabs; Timey has tab variable but `tab` is undefined (bug: line 198-199 references `tab` which is never declared)
- [ ] Dismiss individual inbox items — Paperclip has localStorage-based dismiss; Timey missing
- [ ] Category filter dropdown — Paperclip has "everything/issues_i_touched/join_requests/approvals/failed_runs" filter; Timey missing
- [ ] Issues I touched section — Paperclip shows issues where user commented/was active; Timey missing
- [ ] Join requests — Paperclip shows pending org join requests; Timey missing
- [ ] Retry failed run action inline — Paperclip has retry button per failed run card; Timey navigates to task only
- [ ] Access requests / join request approve/reject — Paperclip has accessApi integration; Timey missing

### B9. Activity Page (Paperclip: Activity.tsx → Timey: missing dedicated page)

- [ ] Dedicated activity page — Paperclip has `/activity` page; Timey's sidebar links to `/ai/activity` but no AiActivityPage component was found
- [ ] Filter by entity type — Paperclip has select filter; needed in Timey
- [ ] ActivityRow component — Paperclip has full ActivityRow with actor identity, entity link; Timey has ai_activity table but no activity list UI

**Note:** Timey has an `ai_activity` table and `aiActivities` data in useAIWorkspaceData, but no dedicated activity page component was found in the audited files.

### B10. Org Page (Paperclip: Org.tsx → Timey: AIOrgPage.tsx)

- [x] Department grouping view
- [x] Manager-to-agent view (2 modes)
- [x] Active/attention/paused counts
- [x] Coverage gaps summary
- [ ] Full org tree with expand/collapse — Paperclip has recursive OrgTreeNode with chevron toggle; Timey groups by department/manager but not recursive
- [ ] Clickable agent links to detail page — Paperclip links to /agents/:id; Timey missing links from org view
- [ ] Agent-to-agent hierarchy (reportsTo) — Paperclip uses reportsTo FK; Timey uses manager_user_id (human only)
- [ ] Status dot per agent row — Paperclip shows color-coded status dot; Timey shows text badge

### B11. Settings Page (Paperclip: CompanySettings.tsx → Timey: AISettingsPage.tsx)

- [x] Workspace policy settings (autonomy, fallback, send policies)
- [x] Default model configuration
- [x] Integration toggles
- [x] Budget/cost guardrail settings
- [x] Audit retention config
- [x] Revision history
- [ ] Company name/description editing — Paperclip has general settings; Timey missing (org name editing)
- [ ] Brand color / appearance settings — Paperclip has color picker; Timey missing
- [ ] OpenClaw invite snippet generation — Paperclip has invite system; Timey missing
- [ ] Company archive — Paperclip has archive company; Timey missing
- [ ] Require board approval for new agents toggle — Paperclip has company-level toggle; Timey missing
- [ ] Members list — Paperclip shows company members; Timey has members data but no settings UI for it

### B12. Dashboard / Home Page (Paperclip: Dashboard.tsx → Timey: AIHomePage.tsx)

- [x] Metric cards (active agents, open tasks, costs, pending approvals)
- [x] Recent activity feed
- [x] 7-day spend trend
- [x] Active agent details panel
- [x] Action queue (approvals/stale/blocked)
- [x] Run status breakdown
- [x] Priority breakdown
- [ ] 4-chart grid (run activity, priority, issue status, success rate) — Paperclip has 4 recharts charts; Timey has bar strips only (no proper charts)
- [ ] Empty state onboarding flow — Paperclip triggers openOnboarding dialog; Timey missing onboarding
- [ ] Recent issues/tasks in a side-by-side grid — Paperclip shows recent issues + recent activity in grid; Timey has action queue instead

---

## Section C — Adapter Config Fields

### C1. claude-local
- `instructionsFilePath` (string, optional) — path to AGENTS.md file
- `chrome` (boolean, optional, advanced) — enable Chrome browser
- `dangerouslySkipPermissions` (boolean, optional, advanced) — skip permission checks, defaults true
- `maxTurnsPerRun` (number, optional, advanced) — default 80

### C2. http
- `url` (string, optional) — webhook URL (https://...)

### C3. opencode-local
- `instructionsFilePath` (string, optional) — path to AGENTS.md file

### C4. openclaw-gateway
**Create mode (minimal):**
- `url` (string) — WebSocket URL (ws://127.0.0.1:18789)

**Edit mode (full):**
- `url` (string) — Gateway URL
- `paperclipApiUrl` (string, optional) — API URL override
- `sessionKeyStrategy` (enum: fixed/issue/run) — default "fixed"
- `sessionKey` (string, optional) — default "paperclip" (shown when strategy=fixed)
- `headers["x-openclaw-token"]` (string, secret field) — gateway auth token
- `role` (string) — default "operator"
- `scopes` (string[], comma-separated) — default ["operator.admin"]
- `waitTimeoutMs` (number) — default 120000
- Device auth: always enabled (informational field)

### C5. process
- `command` (string) — executable command (e.g. node, python)
- `args` (string[], comma-separated) — arguments to command

### C6. cursor
- `instructionsFilePath` (string, optional) — path to AGENTS.md file

### C7. codex-local
- `instructionsFilePath` (string, optional) — path to AGENTS.md file
- `dangerouslyBypassApprovalsAndSandbox` (boolean) — bypass sandbox (also read as `dangerouslyBypassSandbox`)
- `search` (boolean) — enable search tool

**Timey Status:** Timey's AIAgentDetailPage has a runtime form with adapter_type dropdown offering: manual, process, http, claude_local, codex_local. It does NOT have: opencode_local, cursor, openclaw_gateway adapters. Config fields are a single envJson/configJson blob rather than structured form fields.

---

## Section D — Gap Analysis

### D1. In Paperclip but NOT in Timey (highest priority, missing entirely)

1. **Comment system** — IssueDetail has full CommentThread with markdown editor, mentions, reassignment; Timey has no comments on tasks at all
2. **Kanban board view** — KanbanBoard.tsx with dnd-kit drag-and-drop; Timey list-only
3. **Live log streaming** — AgentDetail streams stdout/stderr logs in real time; Timey has no log viewer
4. **Run transcript viewer** — AgentDetail builds transcript from events with tool call display; Timey shows summary only
5. **Inline editing (InlineEditor component)** — title/description editable in-place on issue/goal detail; Timey shows static text
6. **Attachment upload/display** — IssueDetail has file attachments; Timey missing entirely
7. **Sub-task / sub-goal hierarchy** — Paperclip has parentId on issues and goals; Timey flat
8. **Issue identifier system** — ENG-123 style identifiers; Timey has no human-readable IDs
9. **Activity page** — Dedicated /activity route with entity-type filter; Timey's sidebar links to it but no component found
10. **Cost events ledger** — Discrete cost_events table per provider/model; Timey embeds costs in runs
11. **Structured adapter config forms** — 7 adapters with specific field UIs; Timey has raw JSON input blob
12. **Org tree hierarchy** — Agent-to-agent reportsTo relationship with visual tree; Timey manager-user only
13. **Dismiss items in inbox** — localStorage dismiss per item; Timey missing
14. **Inbox "issues I touched" section** — Issues where current user was active; Timey missing
15. **Join requests / access API** — Org join request handling; Timey missing
16. **Agent icon picker** — Visual icon customization; Timey missing
17. **Agent terminate action** — Full lifecycle including termination; Timey has activate/pause only
18. **Session reset** — Reset agent task session; Timey missing
19. **Company/org appearance settings** — Brand color, description editing; Timey settings are AI-policy only
20. **Approval approve/reject UI on task detail** — Paperclip has ApprovalCard; Timey shows pending status only
21. **Properties panel (slide-out)** — Paperclip uses PanelContext for side panel; Timey all inline
22. **Mark issue as read / unread tracking** — Sidebar badges for unread; Timey missing

### D2. In Timey but different/incomplete vs Paperclip

1. **Agent model** — Timey agents are roster/business entities; Paperclip agents are process runners. Timey's ai_agent_runtime partially bridges this but they are architecturally different.
2. **Costs page** — Timey costs work from run data (not dedicated events), missing custom date range, token details per agent
3. **Inbox tab filter** — Bug: `tab` variable referenced at line 198-199 in AiInboxPage.tsx but never declared (will throw ReferenceError)
4. **Agent status vocabulary** — Paperclip: active/running/idle/paused/error/terminated; Timey: draft/active/paused/attention. "terminated" has no Timey equivalent.
5. **Goals — status vocabulary** — Paperclip: planned/in_progress/completed; Timey: on_track/watching/blocked/completed. "planned" and "in_progress" have no Timey equivalents.
6. **Org view** — Paperclip shows agent-to-agent hierarchy; Timey shows department/manager grouping (fundamentally different structure)
7. **Budget tracking** — Paperclip has monthly budget in cents with utilization %; Timey has daily budget in microusd and a workspace-level run cost guardrail
8. **Wakeup sources** — Timey has manual/timer/assignment/automation; Paperclip uses same labels but maps differently (on_demand vs manual)
9. **Approval system** — Timey has full ai_approval table; Paperclip uses heartbeats+issues; the approval models are different in intent

### D3. Already complete in Timey (confirmed matches)

1. Agent list with status, activate/pause
2. Agent detail with runtime config (upsertAiAgentRuntime)
3. Task list with priority sorting and status filtering
4. Task detail with wakeup queue, run history, live widget
5. Goals list with board grouping by status
6. Goal detail with progress tracking
7. Costs page with date presets and agent/project breakdown
8. Inbox with approvals, failed runs, stale tasks, blocked tasks
9. Org page (different structure but functional)
10. Settings page with AI workspace policies
11. Dashboard/home with metric cards and action queue
12. Configuration revision history
13. Live run widget with stage progress and cost gauge
14. Activity table (ai_activity) defined and queryable
15. Workspace data hook (useAIWorkspaceData) covering all 14 AI tables

---

## Section E — Implementation Risks

### E1. API Architecture Mismatch
- **Paperclip** uses REST API (React Query + TanStack Query, REST calls to `/api/*`)
- **Timey** uses SpacetimeDB (real-time subscriptions, reducer calls)
- **Risk:** Paperclip features that poll (e.g. `refetchInterval: 3000` for live runs) are trivially replaced by SpacetimeDB subscriptions. No polling needed in Timey. However, the Paperclip data model must be translated to SpacetimeDB table structure.

### E2. Type System Mismatches
- **Paperclip** uses PostgreSQL UUIDs as primary keys, ISO timestamp strings
- **Timey** uses SpacetimeDB `u64` autoInc for all IDs, `u64` microsecond timestamps
- **Risk:** Any feature that assumes UUID-linkable data (e.g. `companyPrefix` in URLs, `agentRouteRef` which uses name/UUID slug) will need rethinking. Timey uses numeric IDs in URLs.

### E3. UI Library Differences
- **Paperclip** uses Radix UI + Shadcn components (Button, Popover, Dialog, Sheet, Tabs, Collapsible, ScrollArea, etc.)
- **Timey** uses Material UI (MUI v5) for the AI workspace pages
- **Risk:** KanbanBoard uses `@dnd-kit/core` (dnd-kit library). If implementing Kanban in Timey, this library would need to be added and styled with MUI. Comment editors use a custom MarkdownEditor with mention support — needs Timey equivalent.

### E4. Missing Backend Reducers
The following Paperclip capabilities require new SpacetimeDB reducers in Timey:
- `create_issue_comment` / `update_issue_comment` / `delete_issue_comment`
- `upload_attachment` / `delete_attachment` (requires external storage)
- `update_task_title` / `update_task_description` (inline edit)
- `update_goal_title` / `update_goal_description` (inline edit)
- `set_task_parent` (sub-task hierarchy)
- `set_goal_parent` (sub-goal hierarchy)
- `terminate_ai_agent` (full lifecycle)
- `reset_agent_session`
- `mark_task_read`

### E5. Log Streaming
- Paperclip fetches real-time logs from `logStore`/`logRef` pointing to external log storage
- Timey has no log storage infrastructure
- **Risk:** Implementing live log streaming requires either: (a) storing logs in SpacetimeDB (heavy), (b) sidecar log service, or (c) using ai_run_event for structured log entries only

### E6. Comment Thread Architecture
- Paperclip comments are stored with runId linkage to show which run generated a comment
- Timey would need a new `ai_task_comment` table
- Mentions use `@agent:uuid` and `@project:uuid` syntax — need client-side resolution

### E7. Specific Pattern Risks
- **InboxPage bug:** `tab` variable used at line 198-199 of AiInboxPage.tsx is never declared. This will throw a ReferenceError at runtime. The "new" tab filter is non-functional.
- **Costs — project attribution:** Timey computes project costs by finding agents assigned to the project, then summing their runs. Paperclip has direct `cost_events.projectId`. Timey's approach will miss costs from agents that changed project assignment.
- **BigInt serialization:** Timey extensively uses BigInt (u64). Any component passing these to MUI text fields or serializing to JSON must convert (`toString()` or divide for display). This is a recurring bug source.
- **Timestamp display:** Timey timestamps are `u64` milliseconds (not microseconds — verified from `formatBigIntDateTime` using `new Date(Number(value))`). SpacetimeDB timestamps are typically microseconds. Need to verify consistency with CLAUDE.md rules.
- **NONE_U64 sentinel:** Timey uses `18446744073709551615n` as a null-equivalent for u64 foreign keys. Any component that displays or compares these values must check for NONE_U64 before treating as a real ID.
