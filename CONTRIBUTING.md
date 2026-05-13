# Contributing to bundir

## Setup

```bash
git clone <your-fork>
cd bundir
bun install
```

## Development

```bash
# Run the CLI in development mode
bun start

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Lint
bun run lint

# Format
bun run format

# Build for production
bun run build
```

## Project Structure

```
bundir/
├── src/
│   ├── index.ts          # CLI entrypoint (commander)
│   ├── commands.ts       # organize, init, undo logic
│   ├── config.ts         # config loading & merging
│   ├── types.ts          # TypeScript types
│   └── tests/            # test files
├── dist/                 # build output
└── .bundir.json          # sample config
```

## Code Style

- **TypeScript** with strict mode enabled
- **No `any` types** — use proper types or `unknown`
- **No `@ts-ignore` or `@ts-expect-error`**
- Format with Prettier (run `bun run format`)
- Follow existing patterns in the codebase

## Testing

- Write tests alongside code in `src/tests/`
- Use `bun:test` — no extra test framework needed
- Cover edge cases: empty dirs, hidden files, permissions errors
- Run full test suite before submitting a PR

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Keep changes focused — one feature/fix per PR
3. Add or update tests for your changes
4. Ensure `bun test` and `bun run lint` pass
5. Update README if your change affects the user-facing API

## Commit Messages

Use clear, descriptive commit messages. Format:

```
type: brief description

Longer explanation if needed.
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`

## Release Process

Maintainers handle releases:

1. Push a `v*` tag (e.g. `v1.2.0`)
2. GitHub Actions runs tests, builds, and publishes to npm
