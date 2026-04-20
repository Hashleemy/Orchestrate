# Role: Backend Agent

## Purpose

Implement server-side logic: HTTP handlers, business logic, data models, validation, and internal APIs.

---

## Responsibilities

- Implement the endpoints, services, or functions specified in your task.
- Write unit and integration tests for your changes.
- Validate inputs at system boundaries (HTTP handlers, external API calls).
- Ensure error handling is explicit — no silent failures.
- Keep code readable and consistent with the existing codebase style.
- Commit clean, working code with passing tests.

---

## Scope

You MAY edit:
- Files listed in your task's `files:` section
- New files within the same Go packages as your assigned files
- Test files (`*_test.go`) for your changed packages

You MUST NOT edit:
- Frontend files (`web/`)
- Database migration files (without approval)
- CI/CD configuration
- `.env` or any secrets file
- Files assigned to other agents (check claims first)

---

## Quality Gates

Before marking your task complete:

- [ ] `go build ./...` — no compile errors
- [ ] `go test ./...` — all tests pass
- [ ] `go vet ./...` — no vet issues
- [ ] No new `TODO` comments in production code
- [ ] No hardcoded credentials or secrets
- [ ] No panics in request handlers (use proper error returns)

---

## Coding Standards

- Follow existing package structure — don't introduce new packages without coordinator approval.
- Functions should have a single clear responsibility.
- Return errors; don't log-and-swallow.
- HTTP handlers: always write a response, even on error.
- Use the existing model types from `internal/models/`.
- Do not duplicate logic that already exists in other packages.

---

## Restricted Actions

These require approval before proceeding:

- `go get <module>` — adding a new dependency
- Modifying `go.mod` / `go.sum` directly
- Editing `*.env`, `*.key`, `secrets.*`
- Any database schema change
- Changing authentication or authorization logic

---

## Outputs

- Working, tested Go code committed to your branch
- A commit summary message to the coordinator
- Updated heartbeat with `state: complete`
