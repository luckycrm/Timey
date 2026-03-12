# Timey

![Timey Logo](./assets/timeylogo.png)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-2ea44f.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154.svg)](https://tanstack.com/start)
[![SpacetimeDB](https://img.shields.io/badge/SpacetimeDB-Realtime-1f6feb.svg)](https://spacetimedb.com/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-black.svg)](https://bun.sh/)
[![Contributors](https://img.shields.io/badge/Contributors-@luckycrm-ffb020.svg)](./CONTRIBUTORS.md)

Timey is an open-source employee, project, and time management platform for modern teams — now with a built-in **AI Workforce** control plane for managing autonomous agents, tasks, approvals, goals, and costs in real time.

---

## AI Workforce — Highlights

Timey ships a full operator-grade AI control plane under `/ai`. Every surface is backed by live SpacetimeDB subscriptions — no polling, no page refresh.

### Agent Management
- **Agent roster** with live runtime status (idle / running / paused / error)
- **Agent detail** — runtime config, wakeup queue, adapter sessions, run history, event timeline
- Create, configure, and toggle agents without leaving the workspace
- Config revision history with one-click restore on `/ai/agents/:id`

### Task Tracking
- **Task board** with priority, status, assignee, labels, and due dates
- **Task detail** — live execution widget showing active run, latest wakeup, adapter session, spend guardrail, and execution signals in one operator surface
- File attachment support (link-based) — add URLs, filenames, and MIME types directly to tasks
- Comment threads with edit and delete on individual task records
- Label system with colour coding, apply/remove per task

### Approvals
- Pending/resolved/all tab views with inline approve and reject
- **Approval detail** — action type, risk level, metadata payload viewer (key-value + raw JSON), links to originating task and agent
- Approved/rejected confirmation banners with agent notification status

### Goals & Projects
- **Goal board** — outcome-grouped view with progress tracking, status, and linked tasks
- **Goal detail** — delivery signals, linked task queue, agent staffing
- **Project portfolio** — lane view by status with staffing, goal, task, and run rollups
- **Project detail** — operator notes, recent runs, task queue, goal associations

### Inbox & Activity
- Operator inbox for pending approvals and wakeup requests requiring attention
- Activity feed with event-level audit trail across agents, runs, and tasks

### Costs
- Date preset selectors (today / 7d / 30d / 90d)
- Budget pressure indicator, spend trend chart
- Agent spend ranking and project cost rollups

### LLM Providers & Secrets
- Register and manage LLM providers (OpenAI-compatible endpoints) with model ID, base URL, and API key
- Set a default provider per workspace
- Secrets vault — store and reference encrypted key-value secrets for agent tool use

### Org View
- Coverage and manager views for the full AI workforce
- Member headcount, agent count, and activity rollups per org

### Settings & Config
- Workspace-level AI settings with readable config surface
- Restoreable revision history — every settings save creates a diff-tracked revision

### Scheduled Automation
- 15-minute cron job (`process_reminder_cron`) runs as a SpacetimeDB scheduled reducer — queues meeting reminder deliveries automatically without any external worker or cron service

---

## Full Feature Set

- Passwordless OTP authentication with server-side sessions
- Workspace onboarding — create or join by workspace code
- Team membership and invite flows
- Real-time team chat — threads, reactions, mentions, emoji picker, read state, presence
- Global messenger panel available from any page, floating chat windows, floating thread view
- Dyte video call integration — start/join calls from chat, in-app meeting dialog
- Meetings manager — channel and public meeting scheduling with join-window enforcement
- Full-screen calendar — date popup, in-place create/edit, conflict detection, drag reschedule, ICS export
- Public booking pages at `/u/:handle` and `/u/:handle/:eventTypeSlug`
- Booking approval workflow, slot conflict alternatives, guest manage links at `/booking/:token`
- External guest invite links at `/meet/:inviteToken`
- Meeting lifecycle emails via ZeptoMail — request, confirm, decline, reschedule, cancel, `.ics` attachments
- Reminder templates with due-now bulk dispatch and failure tracking
- Global radius tokens and consistent corner system across all surfaces
- Online/offline presence via SpacetimeDB heartbeat
- System notifications for incoming messages when away

---

## Screenshots

![Login](./assets/login.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TanStack Start + TanStack Router + React Query |
| UI | MUI (Material UI) |
| Realtime data | SpacetimeDB (maincloud) |
| API server | Bun + Elysia |
| Auth | Email OTP + signed session cookie |
| Video | Dyte |
| Email | ZeptoMail |
| Package manager | Bun |

---

## Quick Start

### 1. Install dependencies

```bash
bun install
cd server && bun install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# SpacetimeDB
SPACETIMEDB_DB_NAME=timeydb
SPACETIMEDB_HOST=https://maincloud.spacetimedb.com
VITE_SPACETIMEDB_DB_NAME=timeydb
VITE_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com

# Session
SESSION_SECRET=change-me-in-production

# ZeptoMail (email)
ZEPTOMAIL_TOKEN=your-zeptomail-token
ZEPTOMAIL_URL=https://api.zeptomail.com/v1.1/email
SENDER_EMAIL=noreply@yourdomain.com

# Dyte (video calls)
DYTE_ORG_ID=your-dyte-org-id
DYTE_API_KEY=your-dyte-api-key
DYTE_PRESET_NAME=group_call_host

# Server / CORS
VITE_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
```

### 3. Run locally

```bash
bun run dev
```

This starts **both** Vite (frontend) and Elysia (API server) together via `concurrently`.
App runs at `http://localhost:5173`. SpacetimeDB runs on maincloud — no local instance needed.

---

## Page Map

### AI Workforce (`/ai`)
| Route | Description |
|---|---|
| `/ai` | Operator cockpit — action queues, active agents, spend trend, project snapshot |
| `/ai/agents` | Agent roster with live runtime status |
| `/ai/agents/:id` | Agent detail — config, wakeups, runs, event timeline, revision history |
| `/ai/tasks` | Task board with priority, status, labels, assignee |
| `/ai/tasks/:id` | Task detail — live run widget, comments, attachments, labels |
| `/ai/approvals` | Pending / resolved approval queue |
| `/ai/approvals/:id` | Approval detail — payload viewer, risk level, agent/task links |
| `/ai/inbox` | Operator inbox — pending items requiring attention |
| `/ai/activity` | Activity feed — audit trail across agents, runs, tasks |
| `/ai/projects` | Project portfolio in lane view |
| `/ai/projects/:id` | Project detail — staffing, goals, task queue, run history |
| `/ai/goals` | Outcome board grouped by status |
| `/ai/goals/:id` | Goal detail — delivery signals, linked tasks |
| `/ai/costs` | Spend analytics — trend, agent ranking, project rollups |
| `/ai/org` | Coverage and manager views for AI workforce |
| `/ai/settings` | Workspace AI config with restoreable revision history |
| `/ai/llms` | LLM provider management — register, set default |
| `/ai/secrets` | Secrets vault for agent tool credentials |

### Chat & Communication
| Route | Description |
|---|---|
| `/chat` | Team chat, threads, reactions, presence, video call entry |

### Meetings
| Route | Description |
|---|---|
| `/meetings` | Meeting home and scheduling surface |
| `/meetings/calendar` | Full calendar management view |
| `/meetings/requests` | Host booking review and follow-up |
| `/meetings/activity` | Meeting activity and follow-up queue |
| `/meetings/settings` | Guided booking setup — types, availability, reminders |
| `/u/:handle` | Public booking directory |
| `/u/:handle/:eventTypeSlug` | Public booking flow |
| `/booking/:token` | Guest join/manage page |
| `/meet/:inviteToken` | External guest meeting join |

---

## SpacetimeDB Workflow

When changing schema or reducers in `spacetimedb/src/index.ts`:

```bash
# Publish module to maincloud
bun run spacetime:publish

# Regenerate TypeScript client bindings
bun run spacetime:generate
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Vite + Elysia API together |
| `bun run build` | Build production assets |
| `bun run preview` | Preview production client build |
| `bun run spacetime:generate` | Regenerate SpacetimeDB client bindings |
| `bun run spacetime:publish` | Publish SpacetimeDB module to maincloud |

---

## Project Structure

```
src/
  components/
    ai/             AI workforce pages and primitives
  hooks/            Auth and data hooks
  routes/           File-based app routes
  module_bindings/  Generated SpacetimeDB bindings (do not edit)
server/
  routes/           Elysia API routes (auth, dyte, email, llm)
  lib/              Session, email, SpacetimeDB helpers
spacetimedb/
  src/index.ts      Schema + all reducers
```

---

## Implementation Status (March 2026)

### Done

- OTP auth, session lifecycle, workspace onboarding, member invites
- Real-time team chat — threads, reactions, mentions, emoji picker, read state, presence, floating windows
- Dyte video call integration — in-chat start/join, call sessions via SpacetimeDB
- Meetings manager — scheduling, calendar, booking, public pages, guest links, lifecycle emails, ICS attachments
- Reminder templates with due-now bulk dispatch and post-meeting follow-up nudges
- **AI workforce control plane** — agents, tasks, approvals, inbox, activity, projects, goals, costs, org, settings
- **AI runtime tables** — `ai_agent_runtime`, `ai_wakeup_request`, `ai_run_event`, `ai_adapter_session`
- **AI task enhancements** — comments, labels, file attachments, live execution widget
- **AI approval detail** — full payload viewer, risk display, action type, agent/task navigation
- **AI config revision history** — every settings save tracked, one-click restore on agents and workspace settings
- **LLM provider management** — register providers, set default, manage per workspace
- **Secrets vault** — store and reference encrypted credentials for agent tool use
- **15-minute scheduled cron** — `process_reminder_cron` SpacetimeDB scheduled reducer auto-queues meeting reminders

### To Do

- Closed-tab push notifications (Service Worker + Push API + backend Web Push)
- Notification preferences UI (sound, desktop toggle, channel-level controls)
- External calendar sync (Google / Microsoft)
- AI runtime execution worker so queued wakeups turn into real agent runs
- Richer run-log streaming, config diff views, and task/agent-level restore previews
- AI table privacy hardening and export/reporting for multi-tenant production
- Native Timey agent tools (research, proposals, outbound) and external runtime adapters
- End-to-end tests for public booking, guest join, and host request flows

---

## Contributors

- [@luckycrm](https://github.com/luckycrm)
- Full list: [CONTRIBUTORS.md](./CONTRIBUTORS.md)

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create a branch (`feat/your-feature`)
3. Commit with clear messages (`feat: ...`, `fix: ...`)
4. Open a pull request with screenshots/notes when UI changes are included

Generated files (`src/module_bindings/`, `src/routeTree.gen.ts`) must not be manually edited.

See also:
- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Governance](./GOVERNANCE.md)

Automated review: CodeRabbit checks configured via [`.coderabbit.yaml`](./.coderabbit.yaml).

---

## Security Notes

- Keep all secrets in `.env.local` — never commit to source control
- Rotate `SESSION_SECRET` and mail credentials regularly
- SpacetimeDB tables marked `public: true` are visible to all authenticated clients — scope accordingly

## License

Licensed under Apache 2.0. See [LICENSE](./LICENSE).
