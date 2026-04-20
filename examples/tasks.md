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
status: done
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
status: done
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
status: done
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
status: done
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
status: done
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
status: done
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

### TASK-108
status: done
priority: normal
type: refactor
title: Persist showLogs preference per agent in localStorage
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
acceptance:
  - Toggling "Logs" on an AgentCard persists state across page reloads
  - Key is scoped per agent ID
  - Falls back gracefully when localStorage is unavailable
risk: low

### TASK-109
status: done
priority: normal
type: feature
title: Show last heartbeat ISO timestamp as tooltip on heartbeat age
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
acceptance:
  - Hovering the heartbeat age shows the full ISO timestamp via title attribute
  - No layout shift introduced
risk: low

### TASK-110
status: done
priority: normal
type: feature
title: Global "Export All Runs" button in RunHistory
owner: unassigned
depends_on: [TASK-105]
files:
  - web/src/components/RunHistory.tsx
acceptance:
  - Button at top of Run History downloads a single markdown file with all runs
  - Each run is a section with heading, metadata table, completed tasks, and summary
  - Works for 0 runs (disabled state) and N runs
risk: low

### TASK-111
status: done
priority: normal
type: feature
title: Dashboard auto-refresh indicator ("live" vs "stale")
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
  - web/src/App.tsx
acceptance:
  - Small indicator in top bar shows green "LIVE" dot when SSE is connected
  - Turns red "STALE" after 10s without any event
  - Tooltip shows seconds since last event
risk: low

### TASK-112
status: done
priority: normal
type: polish
title: Color-code event types in CommFeed with consistent palette
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Each event type (file_edit, test_run, commit, task_started, ...) has a distinct chip color
  - Color palette documented in a single map
  - Unknown event types fall back to a neutral gray
risk: low

### TASK-113
status: done
priority: normal
type: feature
title: Keyboard shortcut "?" to open a cheat sheet overlay
owner: unassigned
depends_on: [TASK-107]
files:
  - web/src/components/Shortcuts.tsx
  - web/src/App.tsx
acceptance:
  - Pressing ? opens a modal listing all keyboard shortcuts (N, Esc, ?)
  - Esc closes the overlay
  - Overlay has backdrop click-to-close
risk: low

### TASK-114
status: done
priority: normal
type: refactor
title: Extract shared chip/badge styles into a single helper module
owner: unassigned
depends_on: []
files:
  - web/src/components/chips.tsx
  - web/src/components/AgentCard.tsx
  - web/src/components/TaskBoard.tsx
  - web/src/components/ReviewPanel.tsx
acceptance:
  - New chips.tsx exports StatusChip, PriorityChip, RiskChip components
  - At least two components migrated to use them
  - No visual regression
risk: low

### TASK-115
status: done
priority: normal
type: feature
title: Filter tasks by free-text search in title/ID/owner
owner: unassigned
depends_on: []
files:
  - web/src/components/TaskBoard.tsx
acceptance:
  - Search input above the task table filters by substring in id, title, owner
  - Result count shown next to input when active
  - Clear button resets the filter
risk: low

### TASK-116
status: done
priority: normal
type: feature
title: Sticky top bar on Dashboard (header + pills always visible)
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - The Local Agent Orchestrator header + pill row stays visible on scroll
  - Background uses backdrop-filter blur to avoid text clash
  - No layout shift on first paint
risk: low

### TASK-117
status: done
priority: normal
type: feature
title: Copy-to-clipboard icons on branch/task IDs
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
  - web/src/components/TaskBoard.tsx
acceptance:
  - Hovering a branch or task ID reveals a small copy icon
  - Clicking copies the value to clipboard and toasts "Copied"
  - Works in HTTPS and HTTP (http uses execCommand fallback)
risk: low

### TASK-118
status: done
priority: normal
type: feature
title: Highlight newly appeared events in CommFeed for 2s
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - New events get a subtle colored left-border flash for 2 seconds after arrival
  - No flash on initial load — only for events received after mount
risk: low

### TASK-119
status: done
priority: low
type: polish
title: Replace "agent" emoji in Agents empty state with cleaner glyph
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - Agents empty-state uses a Lucide-style outline glyph (svg) instead of emoji
  - Same for other empty states (tasks, runs, comms, approvals, reviews)
risk: low

### TASK-120
status: done
priority: normal
type: feature
title: Show approval trigger icon + color in CheckpointPanel header too
owner: unassigned
depends_on: []
files:
  - web/src/components/CheckpointPanel.tsx
  - web/src/components/ApprovalCard.tsx
acceptance:
  - ApprovalCard uses the same kind icon and color as CheckpointPanel
  - Icon visible in both collapsed and expanded states
  - Visual consistency across approval-related surfaces
risk: low

### TASK-121
status: done
priority: normal
type: feature
title: Dashboard "Everything quiet" hero when no agents + no pending work
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - When agents.length = 0 AND approvals pending = 0 AND checkpoints pending = 0,
    show a single centered hero card suggesting "Click + Start Run"
  - Hides all lower sections to avoid a wall of empty panels
  - Appears only on initial fresh state, not after a run completes
risk: low

### TASK-122
status: done
priority: normal
type: feature
title: Reflect pending approval count in window.title
owner: unassigned
depends_on: []
files:
  - web/src/App.tsx
acceptance:
  - When pending approvals > 0, document.title becomes "(N) Local Agent Orchestrator"
  - When pending approvals = 0, title is restored to "Local Agent Orchestrator"
  - Updates live as approvals resolve
risk: low

### TASK-123
status: done
priority: high
type: feature
title: SSE auto-reconnect with exponential backoff
owner: unassigned
depends_on: []
files:
  - web/src/api/client.ts
acceptance:
  - openStream retries on close/error with exponential backoff (1s, 2s, 4s, 8s, capped at 30s)
  - Resets backoff to 1s on a successful message arrival
  - Cleanup function cancels pending retries
risk: low

### TASK-124
status: done
priority: high
type: feature
title: React ErrorBoundary wrapping the Dashboard
owner: unassigned
depends_on: []
files:
  - web/src/components/ErrorBoundary.tsx
  - web/src/App.tsx
acceptance:
  - Any uncaught render error shows a friendly error screen with the message and a "Reload" button
  - Error details are logged to the console
  - Reload triggers window.location.reload()
risk: low

### TASK-125
status: done
priority: normal
type: feature
title: Click agent in AgentGraph to filter CommFeed to that agent
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentGraph.tsx
  - web/src/components/CommFeed.tsx
  - web/src/pages/Dashboard.tsx
acceptance:
  - Clicking a node in AgentGraph sets an agent filter on CommFeed
  - Active filter shown as a chip above CommFeed with an X to clear
  - Filter matches events where agent == selected OR messages where from/to == selected
risk: low

### TASK-126
status: done
priority: normal
type: feature
title: CommFeed type filter (all / events / messages)
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Three chips at top of CommFeed: All / Events / Messages
  - Active chip highlighted; inactive kinds hidden from the list
  - Default selection is "All"
risk: low

### TASK-127
status: done
priority: low
type: feature
title: Keyboard shortcut / to focus agent filter input
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - Pressing / (when not typing) focuses the agent filter input
  - Escape while focused blurs the input and clears the filter
  - Shortcut documented in the ? cheatsheet
risk: low

### TASK-128
status: done
priority: low
type: feature
title: Persist collapsed state of Dashboard sections in localStorage
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - Each Section can be collapsed via a chevron in its header
  - Collapsed state persists across reloads (per section title)
  - Collapsing hides children but keeps the title and count visible
risk: low

### TASK-129
status: done
priority: normal
type: feature
title: Task detail drawer on click — show acceptance criteria and dependencies
owner: unassigned
depends_on: []
files:
  - web/src/components/TaskDrawer.tsx
  - web/src/components/TaskBoard.tsx
acceptance:
  - Clicking a task row opens a right-side drawer with full task details
  - Drawer shows acceptance checklist, files, depends_on, owner, branch
  - Esc or clicking outside closes the drawer
risk: low

### TASK-130
status: done
priority: normal
type: feature
title: Highlight stale agents (no heartbeat in 90s) in AgentCard + AgentGraph
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
  - web/src/components/AgentGraph.tsx
acceptance:
  - AgentCard shows "STALE — last HB Xs ago" chip when heartbeat > 90s
  - AgentGraph node gains a yellow/orange warning ring when stale
  - Rolls back to normal once a fresh heartbeat is received
risk: low

### TASK-131
status: done
priority: normal
type: feature
title: CommFeed search bar (free-text filter across event detail + message body)
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Text input matches against event.detail, event.type, message.body, from, to
  - Matches are case-insensitive substring
  - Clearing the search returns all items
risk: low

### TASK-132
status: done
priority: normal
type: feature
title: Checkpoint preview — show diff context for protected_merge checkpoints
owner: unassigned
depends_on: []
files:
  - web/src/components/CheckpointPanel.tsx
acceptance:
  - For protected_merge checkpoints, fetch the agent diff like ApprovalCard does
  - Render inline summary (files / +/− / reasons) inside the checkpoint card
  - No diff fetch for non-diff trigger kinds
risk: low

### TASK-133
status: done
priority: low
type: feature
title: Toast stacking + auto-dismiss animation polish
owner: unassigned
depends_on: []
files:
  - web/src/components/Toast.tsx
acceptance:
  - Toasts slide in from bottom-right and fade out after 4s
  - Multiple toasts stack vertically with 8px gap
  - Click dismisses immediately
risk: low

### TASK-134
status: done
priority: normal
type: feature
title: Approval queue bulk-approve minor changes
owner: unassigned
depends_on: []
files:
  - web/src/components/ApprovalQueue.tsx
acceptance:
  - "Approve all minor" button when ≥2 minor pending approvals exist
  - Confirmation prompt before bulk-approve
  - Progress indicator while resolving batch
risk: low

### TASK-135
status: done
priority: low
type: feature
title: RunHistory row expand animation + sticky run header
owner: unassigned
depends_on: []
files:
  - web/src/components/RunHistory.tsx
acceptance:
  - Expanding a row slides open with a 150ms transition
  - When expanded, the run ID header stays sticky at the top of the row
risk: low

### TASK-136
status: done
priority: normal
type: feature
title: Settings modal — configure polling intervals + stale thresholds
owner: unassigned
depends_on: []
files:
  - web/src/components/SettingsModal.tsx
  - web/src/pages/Dashboard.tsx
acceptance:
  - Gear icon in top bar opens the modal
  - Form fields for heartbeat-stale threshold (default 90s) and LIVE threshold (default 10s)
  - Values persist in localStorage and apply live
risk: low

### TASK-137
status: done
priority: low
type: feature
title: Hover-to-copy for commit hashes in event feed
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
  - web/src/components/CopyId.tsx
acceptance:
  - Commit-type events detect sha patterns (7-40 hex chars) in detail and wrap in CopyId
  - Hover reveals copy icon, click copies to clipboard + toasts
  - Non-commit events render as before
risk: low

### TASK-138
status: done
priority: normal
type: feature
title: Pause/Resume individual agent from AgentCard
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
  - web/src/api/client.ts
acceptance:
  - AgentCard shows "Pause" button when agent state is not blocked/stopped/complete
  - Shows "Resume" button when state is blocked by a manual pause flag
  - (UI-only acceptance: button is disabled with tooltip "backend not wired yet" if endpoint absent)
risk: low

### TASK-139
status: done
priority: normal
type: feature
title: Task board grouped view — group by status as columns (Kanban-lite)
owner: unassigned
depends_on: []
files:
  - web/src/components/TaskBoard.tsx
acceptance:
  - Toggle button "List / Board" switches between table and column layout
  - Board view renders a column per status with task cards
  - Empty columns still render with a subtle placeholder
risk: low

### TASK-140
status: done
priority: normal
type: feature
title: CommFeed auto-scroll toggle with "jump to newest" on new items
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Checkbox "auto-scroll to newest"; if user scrolls up, auto-scroll pauses
  - A floating "Jump to newest (N)" button appears when paused with new items
  - Clicking it resumes auto-scroll
risk: low

### TASK-141
status: done
priority: low
type: feature
title: Dim completed/stopped agents in grid when run is active
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
  - web/src/components/AgentCard.tsx
acceptance:
  - When there is at least one active (non-complete/non-stopped) agent, complete/stopped ones render at 60% opacity
  - When all agents are terminal, they render at full opacity
risk: low

### TASK-142
status: done
priority: normal
type: feature
title: Per-task filter on CommFeed (click task_id chip → filter)
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Clicking a task_id code in an event/message row filters the feed to that task
  - Chip above feed shows active task filter with × to clear
  - Works alongside the agent filter (both applied)
risk: low

### TASK-143
status: done
priority: low
type: feature
title: Orchestration graph — show active task_id label under each node
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentGraph.tsx
acceptance:
  - If agent.task_id is set, render it in a small chip below the agent label
  - Chip is clickable and sets the CommFeed task filter (uses TASK-142 hooks)
risk: low

### TASK-144
status: done
priority: normal
type: feature
title: Review panel — show verdict history per worker (expandable)
owner: unassigned
depends_on: []
files:
  - web/src/components/ReviewPanel.tsx
acceptance:
  - Each worker row has an expander showing past verdicts from this run
  - Verdicts show timestamp, outcome, and summary
  - Collapsed by default
risk: low

### TASK-145
status: done
priority: normal
type: feature
title: Communications feed — pin / star notable messages in current session
owner: unassigned
depends_on: []
files:
  - web/src/components/CommFeed.tsx
acceptance:
  - Each row has a star/pin affordance on hover
  - Starred rows persist in a separate filter view ("starred")
  - Starred state persists in localStorage per session
risk: low

### TASK-146
status: done
priority: normal
type: feature
title: Agent card — show last 3 events inline mini-timeline
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentCard.tsx
acceptance:
  - Under each card, a compact strip of the last 3 events for that agent
  - Each entry shows icon + time-ago
  - Clicking an entry filters CommFeed to that agent
risk: low

### TASK-147
status: done
priority: normal
type: feature
title: TaskDrawer — show recent events and messages for the selected task
owner: unassigned
depends_on: []
files:
  - web/src/components/TaskDrawer.tsx
acceptance:
  - Drawer has a lower section listing events and messages with task_id matching
  - Latest 20 entries, newest first
  - "Filter feed to this task" button threads into CommFeed
risk: low

### TASK-148
status: done
priority: low
type: feature
title: Dashboard — compact mode toggle (dense spacing)
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
  - web/src/components/AgentCard.tsx
acceptance:
  - Toolbar toggle labelled Compact that reduces padding/margins across the grid
  - Choice persists in localStorage
  - AgentCard honors compact mode by shrinking to a single-line layout
risk: low

### TASK-149
status: done
priority: normal
type: feature
title: Export run — download a JSON snapshot of the current run
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
acceptance:
  - Top bar has "Export" button that bundles agents/events/messages/verdicts into a JSON file
  - File is downloaded via Blob + createObjectURL
  - Filename contains the current timestamp
risk: low

### TASK-150
status: done
priority: low
type: feature
title: Keyboard shortcut — "g" jumps the viewport to the Orchestration Graph
owner: unassigned
depends_on: []
files:
  - web/src/pages/Dashboard.tsx
  - web/src/components/Shortcuts.tsx
acceptance:
  - Pressing "g" outside an input scrolls to the graph section (smooth)
  - Shortcut listed in the ? overlay
risk: low

### TASK-151
status: done
priority: normal
type: feature
title: SettingsModal — toggle dim-terminal-agents behavior
owner: unassigned
depends_on: []
files:
  - web/src/components/SettingsModal.tsx
  - web/src/settings.ts
  - web/src/pages/Dashboard.tsx
acceptance:
  - Settings has a checkbox "Dim completed/stopped agents during active runs"
  - Default on; unchecking disables dimming in AgentCard grid
  - Persists in localStorage
risk: low

### TASK-152
status: done
priority: normal
type: feature
title: AgentGraph — show review-request count badge on reviewer nodes
owner: unassigned
depends_on: []
files:
  - web/src/components/AgentGraph.tsx
acceptance:
  - If an agent is a reviewer with N open requests, a circular badge shows N near the node
  - Badge uses reviewer yellow color scheme
risk: low


