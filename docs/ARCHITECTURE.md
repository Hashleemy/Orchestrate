# Architecture

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  User / Human                                                │
│  (browser dashboard + PowerShell approval prompts)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Go Orchestrator  (http://127.0.0.1:8080)                   │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  HTTP API    │  │  File Watcher  │  │  SSE Stream    │  │
│  │  /api/*      │  │  agent-comms/  │  │  /api/stream   │  │
│  └──────────────┘  └────────────────┘  └────────────────┘  │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Approvals   │  │  Tasks Service │  │  Sessions      │  │
│  └──────────────┘  └────────────────┘  └────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ reads/writes
┌──────────────────────▼──────────────────────────────────────┐
│  File Event Bus  (agent-comms/)                             │
│  messages/  status/  claims/  events/  approvals/           │
└──────┬─────────────────────────────────────────┬────────────┘
       │ writes                                  │ writes
┌──────▼──────────────────┐  ┌───────────────────▼────────────┐
│  Agent Process A        │  │  Agent Process B               │
│  PowerShell + Claude    │  │  PowerShell + Claude           │
│  Role: backend          │  │  Role: ui                      │
│  Worktree: worktrees/a  │  │  Worktree: worktrees/b         │
└─────────────────────────┘  └────────────────────────────────┘
```

---

## Go Package Map

```
cmd/orchestrator/main.go          ← binary entry: starts HTTP server

internal/
  api/
    server.go                     ← http.Server setup, route registration, embed
    handlers.go                   ← REST + SSE handlers
  orchestrator/
    orchestrator.go               ← agent spawn, worktree lifecycle
  sessions/
    session.go                    ← in-memory session tracking (agent PID, state)
  comms/
    model.go                      ← Message struct
    reader.go                     ← reads message files from agent-comms/messages/
    writer.go                     ← writes message files
    watcher.go                    ← polls agent-comms/ and emits to channel
  tasks/
    model.go                      ← TaskList struct
    service.go                    ← CRUD + transitions
    serializer.go                 ← Markdown serializer
    transitions.go                ← allowed state machine transitions
  parser/
    tasks_parser.go               ← parse tasks.md format
  approvals/
    model.go                      ← Approval struct
    queue.go                      ← in-memory approval queue (thread-safe)
    service.go                    ← approve/deny/pending API
  gitops/
    repo.go                       ← git status, branch, clean checks
    worktrees.go                  ← create/remove/list worktrees
  policy/
    rules.go                      ← lockfile patterns, IsLockfile()
    commands.go                   ← RequiresApproval() for install commands
    protected.go                  ← IsProtectedPath() for secrets
    classifier.go                 ← IsMajorChange() for task risk
  models/
    agent.go                      ← Agent, AgentRole, AgentStatus
    task.go                       ← Task, TaskStatus
    run.go                        ← Run (orchestration session)
    types.go                      ← shared type definitions
  uiembed/
    embed.go                      ← go:embed web/dist → served by API

web/
  src/
    api/client.ts                 ← fetch wrappers for /api/*
    components/AgentCard.tsx      ← agent status card
    components/ApprovalCard.tsx   ← approval request UI
    pages/Dashboard.tsx           ← main view
```

---

## File Event Bus Schema

### `agent-comms/status/<agent-id>.json`
```json
{
  "agent": "agent-backend-01",
  "task_id": "TASK-001",
  "state": "coding",
  "cwd": "C:/path/to/worktree",
  "branch": "agent/backend-01",
  "last_action": "edited internal/api/server.go",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### `agent-comms/events/<agent-id>.jsonl`
```json
{"timestamp":"2024-01-01T00:00:00Z","agent":"agent-backend-01","task_id":"TASK-001","type":"file_edit","detail":"internal/api/server.go"}
```

### `agent-comms/claims/TASK-<id>.json`
```json
{
  "task_id": "TASK-001",
  "agent": "agent-backend-01",
  "claimed_at": "2024-01-01T00:00:00Z"
}
```

### `agent-comms/messages/<from>-<to>-<ts>.json`
```json
{
  "from": "agent-ui-01",
  "to": "agent-backend-01",
  "task_id": "TASK-004",
  "type": "question",
  "priority": "normal",
  "body": "What shape does /api/agents return?"
}
```

### `agent-comms/approvals/<id>.json`
```json
{
  "id": "abc12345",
  "trigger": "package_install",
  "agent": "agent-backend-01",
  "task_id": "TASK-001",
  "detail": "npm install react@18",
  "status": "pending",
  "created_at": "2024-01-01T00:00:00Z",
  "resolved_at": null
}
```

---

## Worktree Layout

Each agent gets a git worktree created by `scripts/launch-agent.ps1`:

```
<repo-root>/../worktrees/
  agent-backend-01/    ← git worktree on branch agent/backend-01
  agent-ui-01/         ← git worktree on branch agent/ui-01
  agent-qa-01/         ← git worktree on branch agent/qa-01
```

Worktrees are created from the integration branch and cleaned up by the coordinator after merge.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | All agent status objects |
| GET | `/api/tasks` | All tasks from tasks.md |
| GET | `/api/events` | All events (merged from all agents) |
| GET | `/api/messages` | All inter-agent messages |
| GET | `/api/approvals` | All approval records |
| POST | `/api/approvals/:id/approve` | Approve a pending request |
| POST | `/api/approvals/:id/deny` | Deny a pending request |
| GET | `/api/stream` | SSE stream of live updates |
| GET | `/` | Embedded React dashboard |
