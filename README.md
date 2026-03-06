# Timey

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-2ea44f.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154.svg)](https://tanstack.com/start)
[![SpacetimeDB](https://img.shields.io/badge/SpacetimeDB-Realtime-1f6feb.svg)](https://spacetimedb.com/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-black.svg)](https://bun.sh/)
[![Contributors](https://img.shields.io/badge/Contributors-@luckycrm-ffb020.svg)](./CONTRIBUTORS.md)

Timey is an open-source employee, project, and time management platform for modern teams.  
It combines passwordless access, organization onboarding, member management, and real-time collaboration into one fast web app.

## What You Get

- Passwordless OTP authentication with server-side sessions
- Workspace onboarding (create or join by workspace code)
- Team membership and invite flows
- Realtime collaboration powered by SpacetimeDB
- Global time awareness for distributed teams
- Clean TypeScript-first codebase ready for open-source contribution

## Product Direction

Timey is built to become a full operating layer for:

- Employee management
- Project management
- Time and coordination management

Current release focuses on identity, workspace setup, members, invites, chat, and real-time foundations.  
Project/task planning and deeper time tracking can be added on top of the existing schema and reducer model.

## Tech Stack

- Frontend: React 19 + TanStack Start + TanStack Router + React Query
- UI: MUI
- Backend runtime: TanStack Start server functions
- Realtime data layer: SpacetimeDB
- Auth: Email OTP + signed session cookie
- Package manager/runtime: Bun

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Create `.env.local`:

```bash
SESSION_SECRET=change-me
ZEPTOMAIL_TOKEN=your-zeptomail-token
VITE_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com
VITE_SPACETIMEDB_DB_NAME=timeydb
```

### 3. Run locally

```bash
bun run dev
```

App runs at `http://localhost:5173`.

## SpacetimeDB Workflow

When changing schema/reducers in `spacetimedb/src/index.ts`:

```bash
bun run spacetime:generate
```

To publish module updates:

```bash
bun run spacetime:publish
```

To build the module directly:

```bash
bun --cwd spacetimedb run build
```

## Scripts

- `bun run dev` start local dev server
- `bun run build` build production assets
- `bun run preview` preview production client build
- `bun run start` run generated server output
- `bun run spacetime:generate` regenerate client bindings
- `bun run spacetime:publish` publish SpacetimeDB module

## Project Structure

```text
src/
  components/       UI and feature components
  hooks/            auth and data hooks
  routes/           file-based app routes
  server/           server functions (OTP, invites, sessions)
  module_bindings/  generated SpacetimeDB bindings (do not edit)
spacetimedb/
  src/index.ts      schema + reducers
```

## Open Source Roadmap

- [x] OTP auth and session lifecycle
- [x] Organization onboarding and workspace joins
- [x] Member invites and workspace membership
- [x] Realtime team chat foundations
- [x] Multi-timezone awareness primitives
- [ ] Project entities, milestones, and ownership
- [ ] Task boards and workflow states
- [ ] Time entries, attendance, and reporting
- [ ] Role-based permissions and audit trails

## Contributors

- [@luckycrm](https://github.com/luckycrm)
- Full list: [CONTRIBUTORS.md](./CONTRIBUTORS.md)

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create a branch (`feat/your-feature`)
3. Commit with clear messages (`feat: ...`, `fix: ...`)
4. Open a pull request with screenshots/notes when UI changes are included

Generated files like `src/module_bindings/` and `src/routeTree.gen.ts` should not be manually edited.

Read:

- [Contributing Guide](./CONTRIBUTING.md)
- [Contributors](./CONTRIBUTORS.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Support](./SUPPORT.md)
- [Governance](./GOVERNANCE.md)

Automated review:

- CodeRabbit checks are configured via [`.coderabbit.yaml`](./.coderabbit.yaml)
- Install/enable the CodeRabbit GitHub App on this repository to activate PR checks

## Security Notes

- Keep secrets in `.env.local`
- Never commit production keys
- Rotate `SESSION_SECRET` and mail credentials regularly

## Funding

If this project helps your team, support ongoing development via GitHub Sponsors.

## License

Licensed under Apache 2.0. See [LICENSE](./LICENSE).
