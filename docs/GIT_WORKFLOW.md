# Git Workflow

## Overview

Each agent works in an isolated git worktree on a dedicated branch. The coordinator reviews and merges once tasks are complete.

---

## Branch Naming

```
agent/<role>-<id>

Examples:
  agent/backend-01
  agent/ui-01
  agent/qa-01
  agent/docs-01
  agent/coordinator-01
```

---

## Worktree Layout

Worktrees are created one level above the repo root to keep them out of the main working tree:

```
<repo-root>/                        ← main worktree (orchestrator source)
<repo-root>/../worktrees/           ← agent worktrees
  agent-backend-01/                 ← branch: agent/backend-01
  agent-ui-01/                      ← branch: agent/ui-01
  agent-qa-01/                      ← branch: agent/qa-01
```

---

## Worktree Creation

The orchestrator calls `scripts/launch-agent.ps1` which runs:

```powershell
git -C <repo-root> worktree add -b agent/<role>-<id> <worktree-path> <base-ref>
```

`base-ref` is typically the `integration` branch or `main` if no integration branch exists.

---

## Commit Rules

- Commit early and often (don't squash everything into one giant commit).
- Commit message format: `<type>: <description>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - Example: `feat: add /api/agents handler`
- Never include secrets, credentials, or generated lock-file changes without approval.
- Do not amend commits that have been reviewed — make new commits instead.
- No `--no-verify` bypasses.

---

## Integration Flow

```
agent/backend-01  ──┐
agent/ui-01       ──┤──▶  integration  ──▶  main
agent/qa-01       ──┘
```

1. Agent completes task and messages coordinator.
2. Coordinator reviews commits in the agent's branch.
3. If acceptable: coordinator merges into `integration`.
4. When all tasks are done and integration is stable: coordinator merges `integration → main` (requires approval).
5. Coordinator removes worktrees after successful merge.

---

## Protected Branches

| Branch | Protection |
|--------|-----------|
| `main` | No direct commits; merge via PR or coordinator only; requires approval |
| `integration` | No direct agent commits; coordinator-managed |
| `agent/*` | Agent-owned; no other agent should commit here |

---

## Commands Reference

```powershell
# Create a worktree (done by launch-agent.ps1)
git -C <repo> worktree add -b agent/backend-01 ../worktrees/agent-backend-01 integration

# List all worktrees
git worktree list

# Remove a worktree after merge
git worktree remove --force ../worktrees/agent-backend-01
git branch -d agent/backend-01

# Check for uncommitted changes in a worktree
git -C ../worktrees/agent-backend-01 status --porcelain

# Show diff between agent branch and integration
git diff integration..agent/backend-01
```

---

## Conflict Resolution

If an agent's branch has conflicts with `integration`:

1. Coordinator messages the affected agent.
2. Agent pulls/rebases `integration` into their branch within their worktree.
3. Agent resolves conflicts, commits, and messages coordinator again.
4. Coordinator re-reviews and merges.

Agents never merge `integration` directly — they rebase or merge-in from it.

---

## Cleanup

After all merges:

```powershell
# Remove worktrees
foreach ($agent in $agents) {
    git worktree remove --force "../worktrees/$agent"
    git branch -d "agent/$role-$id"
}
```

The coordinator initiates this; individual agents do not self-clean.
