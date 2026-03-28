# Contributing to BatAudit

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/). This drives automated changelog generation and semantic versioning via `release-please`.

| Type | When to use |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:` | Adding or updating tests |
| `docs:` | Documentation only |
| `chore:` | Build process, tooling, CI |
| `ci:` | CI/CD changes |

A breaking change must append `!` after the type or include `BREAKING CHANGE:` in the footer:

```
feat!: remove legacy GraphQL reader endpoint
```

## Workflow

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit with the convention above
4. Open a pull request against `main`
5. CI must pass before merging

## Running locally

See the [Quick Demo](README.md#quick-demo) section in the README.

For development (without Docker):

```bash
# 1. Start infrastructure
docker compose up -d   # postgres + redis

# 2. Backend services (separate terminals)
go run ./cmd/api/writer
go run ./cmd/api/reader
go run ./cmd/api/worker

# 3. Frontend dev server
cd frontend && npm run dev
```
