# Event Model

## Overview

Events are the audit trail of the orchestration. Every agent writes append-only JSONL event files. The Go orchestrator reads and streams them to the dashboard.

---

## File Location

```
agent-comms/events/<agent-id>.jsonl
```

One file per agent. Append-only. Never overwrite or truncate.

---

## Event Schema

```typescript
{
  timestamp: string;    // ISO 8601, e.g. "2024-01-15T14:32:01Z"
  agent: string;        // agent ID, e.g. "agent-backend-01"
  task_id: string;      // e.g. "TASK-001"
  type: EventType;
  detail: string;       // human-readable description
}
```

---

## Event Types

| Type | When to emit | Detail guidance |
|------|-------------|----------------|
| `task_started` | Immediately after claiming a task | "starting TASK-001: <title>" |
| `file_edit` | After creating or modifying a file | "<path> — <what changed>" |
| `test_run` | After running tests | "<command> — N passed, M failed" |
| `commit` | After `git commit` | "commit <hash>: <message>" |
| `blocked` | When waiting on something | "blocked: <reason>" |
| `unblocked` | When a block is resolved | "unblocked: <reason>" |
| `approval_requested` | When writing an approval file | "requested approval for: <detail>" |
| `approval_received` | When approval is resolved | "approval <approved/denied>: <detail>" |
| `message_sent` | When sending a message to another agent | "message to <agent>: <summary>" |
| `message_received` | When processing an incoming message | "message from <agent>: <summary>" |
| `completed` | When task is done | "TASK-001 complete: <summary>" |
| `error` | Unexpected failure | "<error description>" |

---

## Examples

```jsonl
{"timestamp":"2024-01-15T14:30:05Z","agent":"agent-backend-01","task_id":"TASK-001","type":"task_started","detail":"starting TASK-001: implement /api/agents and /api/tasks REST endpoints"}
{"timestamp":"2024-01-15T14:33:12Z","agent":"agent-backend-01","task_id":"TASK-001","type":"file_edit","detail":"internal/api/server.go — registered /api/agents route"}
{"timestamp":"2024-01-15T14:35:44Z","agent":"agent-backend-01","task_id":"TASK-001","type":"file_edit","detail":"internal/api/handlers.go — implemented AgentsHandler reading agent-comms/status/"}
{"timestamp":"2024-01-15T14:38:00Z","agent":"agent-backend-01","task_id":"TASK-001","type":"test_run","detail":"go test ./... — 14 passed 0 failed"}
{"timestamp":"2024-01-15T14:39:10Z","agent":"agent-backend-01","task_id":"TASK-001","type":"commit","detail":"commit a1b2c3d: feat: implement /api/agents and /api/tasks handlers"}
{"timestamp":"2024-01-15T14:39:30Z","agent":"agent-backend-01","task_id":"TASK-001","type":"completed","detail":"TASK-001 complete: both endpoints implemented, tested, committed"}
```

---

## Reading Events (Go)

The `comms.Watcher` polls `agent-comms/` and sends new events on a channel. The API `/api/events` endpoint merges events from all JSONL files and returns them sorted by timestamp.

For SSE (`/api/stream`), the watcher pushes new events as `data: <json>\n\n` lines.

---

## Status vs Events

| File type | Purpose | Write pattern |
|-----------|---------|---------------|
| `status/<agent>.json` | Current state snapshot | Overwrite |
| `events/<agent>.jsonl` | Complete audit trail | Append only |

Status answers "what is agent X doing right now?"
Events answer "what has agent X done and when?"
