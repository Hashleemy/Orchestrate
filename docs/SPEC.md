# V1 SPEC — Local Multi-Agent Orchestrator

## Goal

Decompose a user request into role-based agents, execute work in parallel across isolated git worktrees, and present live status in a local dashboard — with hard approval gates on risky operations.

---

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Orchestrator | Go (HTTP server) | Authority: launches agents, serves API, processes approvals |
| Agents | PowerShell + Claude Code CLI | Workers: claim tasks, execute, emit events |
| Git worktrees | `git worktree` | Isolation: one branch + directory per agent |
| File event bus | `agent-comms/` directory | Coordination: status, events, messages, claims, approvals |
| Dashboard | React (embedded in Go binary) | Observability: live agent cards, event feed, approval queue |

---

## Execution Flow

```
User request
  └─▶ Coordinator agent
        ├─▶ Decompose into tasks (tasks.md)
        ├─▶ Write task files to agent-comms/tasks/
        └─▶ Call scripts/launch-agent.ps1 per task
              └─▶ PowerShell window opens (titled: Agent:<id> | Role | Task)
                    └─▶ Claude Code reads CLAUDE.md + role file + task file
                          ├─▶ Claims task (agent-comms/claims/)
                          ├─▶ Executes in worktree
                          ├─▶ Writes heartbeats (agent-comms/status/)
                          ├─▶ Emits events (agent-comms/events/)
                          └─▶ Requests approvals if needed (agent-comms/approvals/)

Go orchestrator (background)
  ├─▶ Watches agent-comms/ via file polling
  ├─▶ Serves /api/* endpoints
  └─▶ Streams updates to dashboard (SSE)
```

---

## Task Lifecycle

```
todo → ready → in_progress → awaiting_review → done
                     │
                     ├──→ blocked → ready (unblocked)
                     │
                     └──→ awaiting_approval → ready (approved)
                                           → cancelled (denied)
```

---

## Agent Lifecycle

```
start → read role + task → claim task → execute → emit events → complete
              │                              │
              └─ heartbeat loop (30-60s)     └─ approval gate if restricted action
```

---

## Directory Layout

```
local-agent-orchestrator/
  CLAUDE.md                 ← agent constitution (read first)
  docs/                     ← specs, architecture, protocol
  templates/
    roles/                  ← per-role boundaries and responsibilities
    tasks/                  ← task file template
  agent-comms/
    messages/               ← inter-agent JSON messages
    status/                 ← heartbeat JSON files (one per agent)
    claims/                 ← task ownership files
    events/                 ← JSONL event logs (one per agent)
    approvals/              ← approval request + response files
  scripts/                  ← PowerShell launchers and helpers
  cmd/orchestrator/         ← Go binary entry point
  internal/                 ← Go packages
  web/                      ← React dashboard source
```

---

## Non-Negotiables

- No `.env` or secrets committed.
- No package installs without explicit approval.
- No cross-scope file edits (agents must stay in their assigned scope).
- No direct merges to `main` — coordinator reviews first.
- All actions must produce an event log entry.
- Agents that stall for >5 minutes without a heartbeat are flagged in the dashboard.

---

## Approval Policy Summary

| Trigger | Auto-blocked | Requires |
|---------|-------------|---------|
| Package install | Yes | Human approval |
| Lockfile change | Yes | Human approval |
| Protected file (.env, *.key) | Yes | Human approval |
| Merge to main/integration | Yes | Human approval |
| Major/architectural change | Yes | Human approval |
| File edit (in scope) | No | — |
| Tests | No | — |
| Commits | No | — |
| Inter-agent messages | No | — |

---

## Observability

The dashboard (served at `http://127.0.0.1:8080`) shows:

- **Agent cards**: id, role, state, task, branch, cwd, last action, heartbeat age
- **Event feed**: real-time stream of all agent events
- **Approval queue**: pending requests with approve/deny buttons
- **Task board**: all tasks with status and owner

Events and status are polled from `agent-comms/` every 2 seconds via SSE.
