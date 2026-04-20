# State Machines

## Task State Machine

### States

| State | Description |
|-------|-------------|
| `todo` | Identified but dependencies not yet met |
| `ready` | All dependencies done; available for assignment |
| `in_progress` | Claimed by an agent, actively being worked on |
| `blocked` | Agent hit an external blocker; waiting to be unblocked |
| `awaiting_review` | Work complete; waiting for reviewer verdict |
| `awaiting_approval` | Requires user approval before continuing (package install, major change, etc.) |
| `done` | Completed and verified |
| `cancelled` | Dropped; will not be completed |

### Valid Transitions

```
todo
  └─▶ ready              (scheduler: all depends_on tasks are done)

ready
  ├─▶ in_progress        (agent claims and starts work)
  └─▶ cancelled          (coordinator decision)

in_progress
  ├─▶ blocked            (agent reports external blocker)
  ├─▶ awaiting_review    (agent submits work for review)
  ├─▶ awaiting_approval  (agent requests approval gate)
  └─▶ cancelled          (coordinator or user decision)

blocked
  └─▶ ready              (blocker resolved; returned to pool)

awaiting_review
  ├─▶ done               (reviewer approves)
  └─▶ in_progress        (reviewer requests changes; agent resumes)

awaiting_approval
  └─▶ ready              (approval granted or denied; returned to pool)

done        — terminal
cancelled   — terminal
```

### Transition Table

| From \ To | todo | ready | in_progress | blocked | awaiting_review | awaiting_approval | done | cancelled |
|-----------|------|-------|-------------|---------|-----------------|-------------------|------|-----------|
| **todo** | — | ✓ | | | | | | |
| **ready** | | — | ✓ | | | | | ✓ |
| **in_progress** | | | — | ✓ | ✓ | ✓ | | ✓ |
| **blocked** | | ✓ | | — | | | | |
| **awaiting_review** | | | ✓ | | — | | ✓ | |
| **awaiting_approval** | | ✓ | | | | — | | |
| **done** | | | | | | | — | |
| **cancelled** | | | | | | | | — |

> Same-status transitions are always treated as a no-op (not an error).

---

## Agent State Machine

### States

| State | Description |
|-------|-------------|
| `idle` | Launched but not yet active |
| `planning` | Reading task file and forming a plan |
| `coding` | Actively editing files |
| `testing` | Running tests or type checks |
| `blocked` | Waiting on external input (another agent, approval, etc.) |
| `awaiting_approval` | Waiting for user to approve a risky operation |
| `complete` | Task finished; agent idle |
| `stopped` | Process exited (clean or crash) |

### Heartbeat Protocol

Agents write their state to `agent-comms/status/<agent-id>.json` every 30–60 seconds:

```json
{
  "agent":       "agent-worker-01",
  "task_id":     "TASK-001",
  "state":       "coding",
  "cwd":         "/worktrees/agent-worker-01",
  "branch":      "agent/worker-01",
  "last_action": "edited internal/api/server.go",
  "timestamp":   "2024-01-15T14:23:00Z",
  "pid":         12345
}
```

An agent is considered **stale** if its timestamp is older than 5 minutes while not in `complete` or `idle` state. Stale agents are flagged in the dashboard.

### Liveness Detection

The `ProcessRegistry` tracks live agent PIDs. An agent is **alive** if its OS process is still running. When the process exits:
- The registry removes the entry
- The session store updates the agent's state to `stopped`
- The dashboard reflects the change on the next SSE push (within 2 seconds)

---

## Run State Machine

### States

| State | Description |
|-------|-------------|
| `idle` | No run active |
| `active` | Agents running, scheduler ticking |
| `paused` | Halted at a checkpoint; waiting for user input |
| `stopped` | Explicitly stopped by user; run record persisted |
| `complete` | All tasks done; run record persisted |

### Checkpoint Gate

When a checkpoint is raised (via `RaiseCheckpoint`), the orchestrator:
1. Persists the checkpoint to `agent-comms/checkpoints/<id>.json`
2. Returns an error from `GuardPendingCheckpoints` for any subsequent orchestration operation
3. The dashboard shows an orange banner listing the checkpoint and its next-step options

The run cannot continue (no new assignments, no merges, no new agents) until the user resolves the checkpoint by choosing a next step.

### Checkpoint Triggers

| Trigger | Kind |
|---------|------|
| Package install requested | `dependency_install` |
| Lockfile changed | `lockfile_change` |
| Major architectural change detected | `major_change` |
| Sensitive file touched | `sensitive_file` |
| Protected branch merge attempted | `protected_merge` |
| Ambiguous architecture decision | `ambiguous_architecture` |
| Meaningful milestone reached | `milestone` |
| Merge conflicts detected | `merge_conflict` |

---

## Scheduler Loop

The scheduler runs every 10 seconds and:

1. Reads `agent-comms/tasks/tasks.md`
2. Builds the dependency graph
3. Detects cycles (errors logged; scheduler skips that tick)
4. Promotes `todo` tasks whose `depends_on` are all `done` → `ready`
5. Writes the updated `tasks.md` back to disk
6. Emits a `task_promoted` event to `agent-comms/events/scheduler.jsonl`

The `ReadyIDs` function returns all `ready` and `todo` (no-dep) task IDs — used by `SpawnWorkers` to assign tasks to workers at launch time.
