# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the TanStack Start app. Put file-based routes in `src/routes/`, shared UI in `src/components/`, auth/data hooks in `src/hooks/`, server functions in `src/server/`, and theme setup in `src/theme/`. The SpacetimeDB module lives in [`spacetimedb/src/index.ts`](/Users/lakhwindersingh/Desktop/timey/spacetimedb/src/index.ts); schema and reducer changes there usually require regenerating client bindings into `src/module_bindings/`.

Treat `src/module_bindings/` and [`src/routeTree.gen.ts`](/Users/lakhwindersingh/Desktop/timey/src/routeTree.gen.ts) as generated output. Do not hand-edit them. `docs/` holds reference docs, while `dist/`, `.output/`, and `.tanstack/` are build artifacts.

## Build, Test, and Development Commands
Use Bun for workspace commands:

- `bun install` installs root dependencies.
- `bun run spacetime:publish` publishes the module in `spacetimedb/` to maincloud.
- `bun run spacetime:generate` regenerates `src/module_bindings/` after schema or reducer changes.
- `bun run dev` starts the app on `http://localhost:5173`.
- `bun run build` creates the production frontend bundle.
- `bun --cwd spacetimedb run build` builds the SpacetimeDB module directly.

## Coding Style & Naming Conventions
This repo is TypeScript-first and runs with `strict` compiler settings. Prefer explicit types at module boundaries, named exports, and small focused components. Follow the surrounding file’s formatting; there is no dedicated ESLint or Prettier config checked in yet.

Use `PascalCase` for React components (`LoginForm.tsx`), `camelCase` for hooks/utilities (`useAuth.ts`), and route filenames that map cleanly to URLs (`login.tsx`, `index.tsx`). Keep SpacetimeDB reducer calls object-shaped, matching the generated bindings.

## Testing Guidelines
No automated test runner is configured yet. Until one is added, validate changes by running `bun run build`, rebuilding the module when needed, and smoke-testing login, session handling, and route navigation against the configured maincloud database.

If you add tests, prefer colocated `*.test.ts` or `*.test.tsx` files and keep server-function tests deterministic by mocking external email delivery.

## Commit & Pull Request Guidelines
This repository does not have an established commit history yet. Use short imperative subjects, preferably Conventional Commit style, for example `feat: add profile update flow` or `fix: regenerate SpacetimeDB bindings`.

PRs should summarize user-visible behavior, list required env/config changes, and note any generated files that were refreshed. Include screenshots for UI changes and the exact commands you used for verification.

## Security & Configuration Tips
Keep secrets in `.env.local`, not in source control. The main runtime variables used today are `SESSION_SECRET`, `ZEPTOMAIL_TOKEN`, `VITE_SPACETIMEDB_HOST`, and `VITE_SPACETIMEDB_DB_NAME`.
