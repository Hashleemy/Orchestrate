# Tasks

## Global Rules
- Do not edit files outside your assigned scope
- Request approval for any package installs
- Write a heartbeat every 30-60 seconds
- Commit clean, passing code only

## Status Values
- todo
- ready
- in_progress
- blocked
- awaiting_review
- awaiting_approval
- done
- cancelled

## Active Tasks

### TASK-001
status: ready
priority: high
type: feature
title: Implement /api/agents and /api/tasks REST endpoints
owner: agent-backend-01
branch: agent/backend-01
worktree: ../worktrees/agent-backend-01
depends_on: []
blocked_by: []
files:
  - internal/api/handlers.go
  - internal/api/server.go
  - internal/orchestrator/orchestrator.go
acceptance:
  - GET /api/agents returns array of agent status objects
  - GET /api/tasks returns array of task objects
  - Both endpoints return empty array (not null) when no data exists
  - go test ./internal/api/... passes
risk: low
major_change: no

### TASK-002
status: ready
priority: high
type: feature
title: Build React dashboard with agent cards and event feed
owner: agent-ui-01
branch: agent/ui-01
worktree: ../worktrees/agent-ui-01
depends_on: [TASK-001]
blocked_by: []
files:
  - web/src/App.tsx
  - web/src/pages/Dashboard.tsx
  - web/src/components/AgentCard.tsx
  - web/src/components/EventFeed.tsx
  - web/src/components/ApprovalCard.tsx
acceptance:
  - Dashboard renders without errors
  - Agent cards show state badge, heartbeat age, last action
  - Event feed shows newest events first
  - Approval cards show Approve/Deny buttons for pending approvals
  - npm run build completes without errors
risk: low
major_change: no

### TASK-026
status: ready
priority: high
type: feature
title: Agent re-spawn — one-click restart of a dead or stale agent
owner: unassigned
branch: agent/backend-02
worktree: ../worktrees/agent-backend-02
depends_on: []
blocked_by: []
files:
  - internal/orchestrator/orchestrator.go
  - internal/api/handlers.go
  - internal/api/router.go
  - web/src/components/AgentCard.tsx
acceptance:
  - POST /api/agents/{id}/respawn kills the old PID (if alive), spawns a new session for the same task and branch
  - AgentCard shows a "Restart" button when agent is dead or stale
  - New session is registered with ProcessRegistry
  - Returns new agent_id and session details
risk: low
major_change: no

### TASK-027
status: ready
priority: high
type: feature
title: Worktree merge UI — merge approved branch into main from the dashboard
owner: unassigned
branch: agent/backend-03
worktree: ../worktrees/agent-backend-03
depends_on: []
blocked_by: []
files:
  - internal/gitops/merge.go
  - internal/orchestrator/merge.go
  - internal/api/handlers.go
  - internal/api/router.go
  - web/src/components/ReviewPanel.tsx
  - web/src/api/client.ts
  - web/src/types.ts
acceptance:
  - POST /api/agents/{id}/merge performs git merge --no-ff of the agent branch into the base branch
  - Blocked if pending checkpoints exist (GuardPendingCheckpoints)
  - Only allowed after a reviewer verdict of "approve"
  - ReviewPanel shows a "Merge" button on approved verdicts
  - Returns merge result (commit hash, output) or error
  - Never force-merges; returns clear error on conflict
risk: normal
major_change: yes

### TASK-028
status: ready
priority: normal
type: feature
title: Task creation UI — create new tasks from the dashboard
owner: unassigned
branch: agent/ui-02
worktree: ../worktrees/agent-ui-02
depends_on: []
blocked_by: []
files:
  - internal/api/handlers.go
  - internal/api/router.go
  - web/src/components/TaskBoard.tsx
  - web/src/api/client.ts
  - web/src/types.ts
acceptance:
  - POST /api/tasks accepts {title, priority, risk, owner, depends_on} and appends a new task to tasks.md
  - TaskBoard shows an "Add Task" button that opens an inline form
  - New task appears in the board immediately after creation
  - title is required; priority defaults to "normal"; status defaults to "ready"
  - go test covers the append logic
risk: low
major_change: no

### TASK-029
status: ready
priority: normal
type: feature
title: Live agent log stream — stream agent stdout into the UI via SSE
owner: unassigned
branch: agent/backend-04
worktree: ../worktrees/agent-backend-04
depends_on: []
blocked_by: []
files:
  - internal/sessions/logstream.go
  - internal/api/handlers.go
  - internal/api/router.go
  - web/src/components/AgentCard.tsx
  - web/src/api/client.ts
acceptance:
  - GET /api/agents/{id}/logs streams the agent's event file (agent-comms/events/<id>.jsonl) as SSE, tailing new lines
  - AgentCard has a "Logs" toggle that opens a scrollable pane showing live log lines
  - Stream closes cleanly when the client disconnects
  - Falls back gracefully when the log file doesn't exist yet
risk: low
major_change: no

### TASK-003
status: todo
priority: normal
type: test
title: Write integration tests for approval flow
owner: unassigned
branch: agent/qa-01
worktree: ../worktrees/agent-qa-01
depends_on: [TASK-001]
blocked_by: []
files:
  - internal/orchestrator/orchestrator_test.go
  - internal/approvals/queue_test.go
acceptance:
  - Test: pending approval appears in FileApprovals()
  - Test: ResolveFileApproval sets status to approved/denied
  - Test: resolved approval file is updated on disk
  - go test ./... passes
risk: low
major_change: no

### TASK-100
status: done
priority: high
type: feature
title: Animate message flow along graph edges when agents communicate
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentGraph.tsx
acceptance:
  - Recent message_sent/message_received events pulse a dot along the edge from sender to receiver
  - Pulse fades within 2 seconds of the event
  - No pulse for unrelated agents
risk: low

### TASK-101
status: done
priority: normal
type: feature
title: Draw reviewer-to-worker edges in the orchestration graph
owner: unassigned
depends_on: [TASK-100]
files:
  - web/src/components/AgentGraph.tsx
acceptance:
  - Reviewer agents (role = reviewer) draw a dotted edge to the worker they are reviewing
  - Worker target derived from review requests payload
  - Edge styled differently from coordinator edges (yellow dashes)
risk: low

### TASK-102
status: todo
priority: high
type: feature
title: Toast notifications for push/merge/respawn actions
owner: unassigned
depends_on: []
files:
  - web/src/components/Toast.tsx
  - web/src/components/AgentCard.tsx
  - web/src/pages/Dashboard.tsx
acceptance:
  - Push, merge, respawn results surface a toast (success/warning/error)
  - Toasts auto-dismiss after 4s or on click
  - Multiple toasts stack vertically in top-right corner
risk: low

### TASK-103
status: todo
priority: normal
type: feature
title: Agent filter bar — search by ID/state/branch
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - Input above agent cards filters by substring in agent ID or branch
  - State pills clickable to filter by state (coding, blocked, etc)
  - "Clear filters" button when any filter is active
risk: low

### TASK-104
status: todo
priority: normal
type: feature
title: /api/health endpoint returning version, uptime, go version, agent count
owner: unassigned
depends_on: []
files:
  - internal/api/handlers.go
  - internal/api/router.go
acceptance:
  - GET /api/health returns {version, uptime_sec, go_version, agents_alive, started_at}
  - Reports uptime from server start, not request time
  - Smoke test: curl returns valid JSON
risk: low

### TASK-105
status: todo
priority: low
type: feature
title: Export run summary as Markdown download
owner: unassigned
depends_on: []
files:
  - web/src/components/RunHistory.tsx
acceptance:
  - Each run in history has "Export" button
  - Generates markdown summary (tasks done, duration, workers, event count)
  - Triggers file download via Blob + URL.createObjectURL
risk: low

### TASK-106
status: todo
priority: low
type: polish
title: Better empty-state copy across the dashboard
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
  - web/src/components/ApprovalQueue.tsx
  - web/src/components/CheckpointPanel.tsx
  - web/src/components/ReviewPanel.tsx
acceptance:
  - Each section has a helpful empty state explaining what shows up here
  - Includes a small icon where appropriate
  - No empty panels with just a border
risk: low

### TASK-107
status: todo
priority: low
type: feature
title: Keyboard shortcut N to open Add Task form
owner: unassigned
depends_on: []
files:
  - web/src/components/TaskBoard.tsx
acceptance:
  - Pressing N (when not typing in an input) opens the Add Task form and focuses the title
  - Escape closes the form
  - Shortcut visible in a small hint near the button
risk: low
