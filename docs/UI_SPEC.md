# UI Spec

## Overview

The dashboard is a React single-page app embedded in the Go binary. It is served at `http://127.0.0.1:8080` and updates in real-time via SSE at `/api/stream`.

---

## Views

### 1. Dashboard (default)

The main view. Divided into four sections:

```
┌──────────────────────────────────────────────────────────────┐
│  Local Agent Orchestrator                    [Run ID: abc123] │
├─────────────────────┬────────────────────────────────────────┤
│  AGENTS (4)         │  EVENTS (live feed)                    │
│  ┌───────────────┐  │  14:32:01  agent-backend-01  file_edit │
│  │ agent-bk-01   │  │  14:32:15  agent-ui-01       file_edit │
│  │ coding        │  │  14:33:00  agent-qa-01       test_run  │
│  │ TASK-001      │  │  14:33:30  agent-bk-01       commit    │
│  │ ♥ 12s ago    │  │                                         │
│  └───────────────┘  ├────────────────────────────────────────┤
│  ┌───────────────┐  │  APPROVALS (1 pending)                 │
│  │ agent-ui-01   │  │  ┌──────────────────────────────────┐  │
│  │ testing       │  │  │ agent-backend-01                 │  │
│  │ TASK-002      │  │  │ package_install                  │  │
│  │ ♥ 8s ago     │  │  │ npm install zod@3               │  │
│  └───────────────┘  │  │ [Approve]  [Deny]               │  │
│                     │  └──────────────────────────────────┘  │
├─────────────────────┴────────────────────────────────────────┤
│  TASKS                                                        │
│  TASK-001  in_progress  agent-backend-01  Implement REST API  │
│  TASK-002  in_progress  agent-ui-01       Build Dashboard     │
│  TASK-003  todo         —                 Write QA tests      │
└──────────────────────────────────────────────────────────────┘
```

---

## Agent Card

Each agent is represented by a card showing:

| Field | Source | Notes |
|-------|--------|-------|
| `id` | `status.agent` | e.g. "agent-backend-01" |
| `role` | derived from ID | e.g. "backend" |
| `state` | `status.state` | colored badge |
| `task_id` | `status.task_id` | links to task detail |
| `branch` | `status.branch` | e.g. "agent/backend-01" |
| `cwd` | `status.cwd` | truncated path |
| `last_action` | `status.last_action` | one-line description |
| `heartbeat` | time since `status.timestamp` | "12s ago"; red if >5 min |
| `approval` | from approvals matching agent | shown if awaiting |

State badge colors:
- `idle` → grey
- `planning` → blue
- `coding` → green
- `testing` → cyan
- `blocked` → orange
- `awaiting_approval` → yellow/amber
- `complete` → dark green

Stale heartbeat (>5 min): card border turns red.

---

## Event Feed

Shows all events from all agents, sorted by timestamp descending (newest first).

Each row:
```
<timestamp>  <agent-id>  <type badge>  <detail>
```

Type badge colors:
- `task_started` → blue
- `file_edit` → grey
- `test_run` → cyan
- `commit` → green
- `blocked` → orange
- `approval_requested` → yellow
- `approval_received` → purple
- `completed` → dark green
- `error` → red

Feed updates via SSE: new events prepended in real time.

---

## Approval Card

Shown in the "APPROVALS" panel when `status: pending`:

```
┌─────────────────────────────────────┐
│ agent-backend-01                    │
│ Trigger: package_install            │
│ Task: TASK-001                      │
│ Detail: npm install zod@3           │
│ Requested: 2 minutes ago            │
│                                     │
│ [Approve]              [Deny]       │
└─────────────────────────────────────┘
```

Clicking Approve → `POST /api/approvals/:id/approve`
Clicking Deny → `POST /api/approvals/:id/deny`

After action: card moves to resolved section (greyed out with status label).

---

## Task Board

Simple table showing all tasks:

| ID | Status | Owner | Title | Risk |
|----|--------|-------|-------|------|
| TASK-001 | in_progress | agent-backend-01 | Implement REST API | low |
| TASK-002 | in_progress | agent-ui-01 | Build Dashboard | low |
| TASK-003 | todo | — | Write QA tests | low |

Status badge colors match task state machine:
- `todo` → grey
- `ready` → blue
- `in_progress` → green
- `blocked` → orange
- `awaiting_review` → yellow
- `awaiting_approval` → amber
- `done` → dark green
- `cancelled` → red

---

## API Data Contracts

### `GET /api/agents`
```typescript
AgentStatus[]
interface AgentStatus {
  agent: string;
  task_id: string;
  state: string;
  cwd: string;
  branch: string;
  last_action: string;
  timestamp: string;
}
```

### `GET /api/events`
```typescript
Event[]
interface Event {
  timestamp: string;
  agent: string;
  task_id: string;
  type: string;
  detail: string;
}
```

### `GET /api/approvals`
```typescript
Approval[]
interface Approval {
  id: string;
  trigger: string;
  agent: string;
  task_id: string;
  detail: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  resolved_at: string | null;
}
```

### `GET /api/tasks`
```typescript
Task[]
interface Task {
  id: string;
  status: string;
  title: string;
  owner: string;
  priority: string;
  risk: string;
  depends_on: string[];
}
```

### `GET /api/stream` (SSE)
```
event: agent_update
data: {"type":"agent_update","agent":{...AgentStatus}}

event: event
data: {"type":"event","event":{...Event}}

event: approval
data: {"type":"approval","approval":{...Approval}}
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 |
| Language | TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| State | React hooks (useState, useEffect) |
| Real-time | EventSource (SSE) |
| HTTP | fetch API |

The built output (`web/dist/`) is embedded into the Go binary via `go:embed` in `internal/uiembed/embed.go`.
