# Contributing to Timey

Thanks for helping improve Timey.

## Development Setup

```bash
bun install
bun run dev
```

If you change SpacetimeDB schema/reducers in `spacetimedb/src/index.ts`, regenerate bindings:

```bash
bun run spacetime:generate
```

## Branch and Commit Style

- Create feature branches from `main`
- Prefer Conventional Commits:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `chore: ...`

## Pull Request Checklist

- Keep scope focused and explain user impact
- Include screenshots for UI changes
- Note any environment/config updates
- Mention generated files that changed
- Ensure local build passes:

```bash
bun run build
```

## Code Guidelines

- TypeScript strict mode is expected
- Use named exports and focused components
- Do not hand-edit generated files:
  - `src/module_bindings/*`
  - `src/routeTree.gen.ts`

## Reporting Issues

Use GitHub Issues with clear repro steps, expected behavior, and actual behavior.

## License

By contributing, you agree that your contributions are licensed under Apache 2.0.
