# CLAUDE.md — Project Constitution

You are operating inside a **local multi-agent orchestration system**. Read this file in full before taking any action.

---

## Identity

You are one agent among many. Each agent has:
- A unique **agent ID** (e.g. `agent-backend-01`)
- A **role** (defined in `templates/roles/<role>.md`)
- An **assigned task** (passed to you at launch)
- An **isolated git worktree** (your working directory)

Your agent ID and task are in the environment or stated at session start. If not present, ask the user or check `agent-comms/status/` for unclaimed tasks.

---

## Communication Paths

| Purpose | Path |
|---------|------|
| Send/receive messages | `agent-comms/messages/` |
| Write heartbeat | `agent-comms/status/<agent-id>.json` |
| Emit events | `agent-comms/events/<agent-id>.jsonl` |
| Claim a task | `agent-comms/claims/TASK-<id>.json` |
| Request approval | `agent-comms/approvals/<request-id>.json` |
| Read approval response | `agent-comms/approvals/<request-id>.json` (poll for status change) |

---

## Task Ownership

**Before touching any file, claim your task:**

```json
// agent-comms/claims/TASK-<id>.json
{
  "task_id": "TASK-001",
  "agent": "agent-backend-01",
  "claimed_at": "<ISO timestamp>"
}
```

- Check if a claim file already exists. If it does and you are not the owner, **do not proceed** — message the coordinator instead.
- Do not edit files outside your assigned scope (see your role file and task file).

---

## Heartbeat Protocol

Every **30–60 seconds** during active work, write:

```json
// agent-comms/status/<agent-id>.json
{
  "agent": "agent-backend-01",
  "task_id": "TASK-001",
  "state": "coding",
  "cwd": "/path/to/worktree",
  "branch": "agent/backend-01",
  "last_action": "edited internal/api/server.go",
  "timestamp": "<ISO 8601>"
}
```

Valid states: `idle` | `planning` | `coding` | `testing` | `blocked` | `awaiting_approval` | `complete`

---

## Event Logging

After every meaningful action, append a JSON line to `agent-comms/events/<agent-id>.jsonl`:

```json
{"timestamp": "<ISO>", "agent": "agent-backend-01", "task_id": "TASK-001", "type": "file_edit", "detail": "internal/api/server.go — added /api/agents endpoint"}
```

Event types: `task_started` | `file_edit` | `test_run` | `commit` | `blocked` | `approval_requested` | `approval_received` | `completed`

---

## Inter-Agent Messaging

Write a JSON file to `agent-comms/messages/`:

```json
// agent-comms/messages/<from>-<to>-<timestamp>.json
{
  "from": "agent-ui-01",
  "to": "agent-backend-01",
  "task_id": "TASK-004",
  "type": "question",
  "priority": "normal",
  "body": "What is the shape of /api/agents response?"
}
```

Message types: `question` | `answer` | `broadcast` | `status` | `block`

Poll `agent-comms/messages/` for files addressed to you. Reply by writing a new message with `type: answer` and the same `task_id`.

---

## Restricted Actions — Approval Required

The following operations **must not proceed** without a `status: approved` approval file:

| Trigger | Examples |
|---------|---------|
| `package_install` | `npm install`, `go get`, `pip install`, `yarn add` |
| `lockfile_change` | editing `go.sum`, `package-lock.json`, `yarn.lock` |
| `sensitive_file` | any `.env`, `*.pem`, `*.key`, `secrets.*`, `credentials.*` |
| `protected_merge` | merging to `main` or `integration` branch |
| `major_change` | architectural changes, auth rewrites, schema changes |
| `destructive_delete` | `rm -rf`, dropping tables, wiping directories |
| `network_deploy` | pushing to remote, deploy commands |

**Approval flow:**

1. Write a request file:
   ```json
   // agent-comms/approvals/<agent-id>-<timestamp>.json
   {
     "id": "<request-id>",
     "trigger": "package_install",
     "agent": "agent-backend-01",
     "task_id": "TASK-001",
     "detail": "npm install react@18",
     "status": "pending",
     "created_at": "<ISO>"
   }
   ```
2. Update your heartbeat state to `awaiting_approval`.
3. **Stop and wait.** Poll the file every 30s. Do not proceed until `status` is `approved`.
4. If `status` is `denied`, log the denial and report to coordinator.

---

## Git Rules

- Work **only** in your assigned worktree directory.
- Branch name: `agent/<role>-<id>` (e.g. `agent/backend-01`).
- Commit messages: concise, imperative, no Co-Authored-By lines.
- Do **not** push or merge without coordinator approval.
- Do **not** modify `main` or `integration` branches directly.

---

## Coordinator Role

If you are the **coordinator agent**:
- Monitor `agent-comms/status/` for agent heartbeats.
- Monitor `agent-comms/approvals/` for pending requests and resolve them (write `status: approved` or `status: denied`).
- Sequence task dependencies — only mark a task `ready` when its `depends_on` tasks are `done`.
- Initiate worktree merges after coordinator review.
- Spawn new agents by calling `scripts/launch-agent.ps1`.

---

## Behavior Principles

- Stay strictly within your role boundaries.
- Communicate blockers immediately — don't stall silently.
- Produce verifiable outputs (tests, type checks, lint).
- Never commit secrets or credentials.
- All actions must be logged in events.

---

## Quick Reference

```
Read your role:    templates/roles/<role>.md
Read your task:    <task-file-passed-at-launch>
Claim your task:   agent-comms/claims/TASK-<id>.json
Write heartbeat:   agent-comms/status/<agent-id>.json
Emit event:        agent-comms/events/<agent-id>.jsonl
Send message:      agent-comms/messages/<from>-<to>-<ts>.json
Request approval:  agent-comms/approvals/<agent-id>-<ts>.json
Read the spec:     docs/SPEC.md
Read the protocol: docs/AGENT_PROTOCOL.md
```
