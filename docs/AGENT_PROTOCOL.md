# Agent Protocol

## Overview

Every Claude Code agent session follows this protocol. Deviating from it breaks coordination and may cause task conflicts.

---

## Lifecycle

```
1. SESSION START
   ├── Read CLAUDE.md (constitution)
   ├── Read templates/roles/<role>.md (your boundaries)
   ├── Read your task file (scope, deliverables, acceptance criteria)
   └── Identify your agent ID (from env or session context)

2. CLAIM
   ├── Check agent-comms/claims/TASK-<id>.json
   │   ├── Exists + you are owner → proceed
   │   ├── Exists + different owner → message coordinator, stop
   │   └── Does not exist → write claim file, proceed
   └── Write initial heartbeat (state: planning)

3. EXECUTE
   ├── Work within your worktree only
   ├── Write heartbeat every 30–60 seconds
   ├── Emit event after each meaningful action
   ├── Check messages/ for incoming messages periodically
   ├── Gate on approvals for restricted actions (see POLICY.md)
   └── Do not edit files outside your task scope

4. COMPLETE
   ├── Run acceptance checks (tests, type-check, lint)
   ├── Make a clean commit (or series of commits)
   ├── Write final event (type: completed)
   ├── Update heartbeat (state: complete)
   └── Message coordinator: task complete, ready for review
```

---

## States

| State | Meaning |
|-------|---------|
| `idle` | No active task |
| `planning` | Reading task, forming approach |
| `coding` | Actively editing files |
| `testing` | Running tests or verification |
| `blocked` | Waiting on dependency or another agent |
| `awaiting_approval` | Halted pending human approval |
| `complete` | Task finished, awaiting coordinator review |

---

## Heartbeat Format

File: `agent-comms/status/<agent-id>.json`

```json
{
  "agent": "agent-backend-01",
  "task_id": "TASK-001",
  "state": "coding",
  "cwd": "C:/Users/user/dev/project/../worktrees/agent-backend-01",
  "branch": "agent/backend-01",
  "last_action": "added /api/agents handler in internal/api/handlers.go",
  "timestamp": "2024-01-15T14:32:00Z"
}
```

Rules:
- Overwrite the same file on each heartbeat (not append).
- Use ISO 8601 timestamps.
- `last_action` must be a meaningful one-line description.
- If you stop working, write a final heartbeat with `state: complete` or `state: idle`.

---

## Event Format

File: `agent-comms/events/<agent-id>.jsonl` (append-only)

```json
{"timestamp":"2024-01-15T14:32:01Z","agent":"agent-backend-01","task_id":"TASK-001","type":"task_started","detail":"beginning TASK-001: implement /api/agents endpoint"}
{"timestamp":"2024-01-15T14:35:12Z","agent":"agent-backend-01","task_id":"TASK-001","type":"file_edit","detail":"internal/api/handlers.go — added AgentsHandler"}
{"timestamp":"2024-01-15T14:38:00Z","agent":"agent-backend-01","task_id":"TASK-001","type":"test_run","detail":"go test ./... — 12 passed 0 failed"}
{"timestamp":"2024-01-15T14:39:30Z","agent":"agent-backend-01","task_id":"TASK-001","type":"commit","detail":"feat: add /api/agents endpoint"}
{"timestamp":"2024-01-15T14:40:00Z","agent":"agent-backend-01","task_id":"TASK-001","type":"completed","detail":"TASK-001 done, all acceptance criteria met"}
```

Event types:
- `task_started` — first event when claiming a task
- `file_edit` — a file was created or modified (include path + summary)
- `test_run` — tests executed (include pass/fail counts)
- `commit` — a commit was made (include message)
- `blocked` — agent is blocked (include reason)
- `approval_requested` — submitted an approval request
- `approval_received` — received an approval decision
- `completed` — task finished

---

## Messaging

Write a new JSON file to `agent-comms/messages/`:

Filename: `<from>-<to>-<unix-timestamp>.json`

```json
{
  "from": "agent-ui-01",
  "to": "agent-backend-01",
  "task_id": "TASK-004",
  "type": "question",
  "priority": "normal",
  "body": "Does /api/agents return an array or an object keyed by agent ID?"
}
```

To check for incoming messages: scan `agent-comms/messages/` for files where `to` matches your agent ID or `to: broadcast`.

Reply: write a new message with `type: answer`, same `task_id`, from/to swapped.

Priority levels: `low` | `normal` | `high` | `urgent`

---

## Claim File Format

File: `agent-comms/claims/TASK-<id>.json`

```json
{
  "task_id": "TASK-001",
  "agent": "agent-backend-01",
  "claimed_at": "2024-01-15T14:30:00Z"
}
```

Rules:
- Write atomically (write to a temp file, rename — or just write once if no conflict).
- Check for existence before writing.
- Never overwrite another agent's claim.

---

## Approval Request Format

File: `agent-comms/approvals/<agent-id>-<unix-timestamp>.json`

```json
{
  "id": "agent-backend-01-1705326600",
  "trigger": "package_install",
  "agent": "agent-backend-01",
  "task_id": "TASK-001",
  "detail": "need to run: npm install zod@3 — required for schema validation",
  "status": "pending",
  "created_at": "2024-01-15T14:30:00Z"
}
```

Poll this file after writing it. When `status` changes to `approved` or `denied`, act accordingly. Log the outcome as an `approval_received` event.

---

## Coordinator Protocol

The coordinator agent has elevated responsibilities:

```
On start:
  - Announce presence via broadcast message
  - Scan agent-comms/status/ to discover running agents
  - Check agent-comms/claims/ to see which tasks are claimed

Continuously:
  - Poll agent-comms/status/ — flag agents with stale heartbeats (>5 min)
  - Poll agent-comms/approvals/ — resolve pending approvals
  - Poll agent-comms/messages/ — route messages if needed

On task completion:
  - Review the agent's commit(s)
  - If acceptable: initiate merge to integration branch
  - If not: message agent with required changes (task → in_progress again)

On all tasks done:
  - Merge integration → main (requires approval)
  - Announce completion
```

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Claim conflict | Message coordinator, wait for resolution |
| Dependency blocked | Set state to `blocked`, message blocking agent |
| Test failure | Fix before committing; do not mark complete |
| Approval denied | Log event, message coordinator, await guidance |
| Out-of-scope file needed | Message coordinator or relevant agent; do not edit |
| Unknown error | Log event with type `blocked` and full detail |
