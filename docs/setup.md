# Setup Guide

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Go | 1.22 | https://go.dev/dl/ |
| Node.js | 18 LTS | https://nodejs.org/ |
| Git | 2.30 | https://git-scm.com/ |
| Claude Code CLI | latest | `npm install -g @anthropic-ai/claude-code` |
| PowerShell | 7+ | https://github.com/PowerShell/PowerShell/releases |
| Windows Terminal | optional | Microsoft Store or `winget install Microsoft.WindowsTerminal` |

> Claude Code must be authenticated before running agents. Run `claude` once in a terminal and follow the login flow.

---

## Installation

### 1. Clone the repository

```powershell
git clone <repo-url> local-agent-orchestrator
cd local-agent-orchestrator
```

### 2. Install Node dependencies and build the UI

```powershell
cd web
npm install
npm run build
cd ..
```

This produces the compiled dashboard in `internal/uiembed/dist/`, which is embedded into the Go binary.

### 3. Build the Go binary

```powershell
go build -o orchestrator.exe ./cmd/orchestrator
```

Or use `make build` to do both steps at once.

---

## First Run

### 1. Start the orchestrator

```powershell
./orchestrator.exe
```

The server starts on `http://localhost:8080` (configurable via `ORCHESTRATOR_ADDR`).

### 2. Open the dashboard

Navigate to `http://localhost:8080` in a browser. You should see the Local Agent Orchestrator dashboard with no agents running.

### 3. Prepare a tasks.md file

See `examples/tasks.md` for the format. Each task block requires:

```markdown
### TASK-001
status: ready
priority: high
type: feature
title: Your task description
owner: unassigned
branch: none
worktree: none
depends_on: []
blocked_by: []
files:
  - path/to/scope/**
acceptance:
  - criterion one
risk: low
major_change: no
```

### 4. Start a run

1. Click **+ Start Run** in the dashboard
2. Paste your `tasks.md` content
3. Select the number of worker agents (1–5)
4. Click **Start Run**

The orchestrator writes `tasks.md` to `agent-comms/tasks/`, then launches:
- One **coordinator** agent (always)
- N **worker** agents (one per selected slot, assigned to ready tasks)

Each agent opens in its own PowerShell window (or Windows Terminal tab if WT is installed).

### 5. Respond to checkpoints and approvals

When an agent reaches a checkpoint (major change, package install, protected file, etc.), an orange banner appears in the dashboard. Click a next-step button to continue or abort.

When an agent requests approval for a risky operation, it appears in the **Approvals** panel. Click **Approve** or **Deny**.

---

## Development Mode

Run the UI watcher and Go server in separate terminals for hot-reload during development:

**Terminal 1 — UI watcher:**
```powershell
cd web
npm run watch
```

**Terminal 2 — Go server:**
```powershell
go run ./cmd/orchestrator
```

The Go server serves the latest built UI from `internal/uiembed/dist/`. Refresh the browser after the watcher rebuilds.

---

## Configuration

All configuration is via environment variables:

```powershell
$env:ORCHESTRATOR_ADDR    = "0.0.0.0:8080"   # HTTP listen address
$env:REPO_ROOT            = "C:\path\to\repo" # Repo to orchestrate (auto-detected)
$env:USE_WINDOWS_TERMINAL = "1"               # Force Windows Terminal tab mode
```

---

## Directory Layout After First Run

```
agent-comms/
  status/           ← agent heartbeat files (<agent-id>.json)
  events/           ← per-agent event logs (<agent-id>.jsonl)
  messages/         ← inter-agent messages
  claims/           ← task claim files (TASK-<id>.json)
  approvals/        ← approval request/response files
  tasks/            ← active tasks.md and state sidecar
  runs/             ← persisted run history records
  reviews/          ← reviewer request and verdict files
<repo-parent>/
  worktrees/
    agent-coordinator-01/   ← coordinator worktree
    agent-worker-01/        ← worker 1 worktree
    agent-worker-02/        ← worker 2 worktree
    ...
```

---

## Troubleshooting

**`claude` not found in agent windows**
Ensure the Claude Code CLI is on the system PATH, not just the user PATH. Run `where.exe claude` in a new PowerShell window to verify.

**Worktree creation fails with "branch already exists"**
The launcher reuses existing worktrees safely. If a previous run left a broken worktree, run `git worktree prune` in the repo root.

**Dashboard shows no data after starting a run**
Check that `agent-comms/` exists in the repo root and is writable. The orchestrator creates it automatically, but permission issues can prevent creation.

**Agents launch but appear stale immediately**
Agents write heartbeats every 30–60 seconds. A fresh agent may appear stale for up to one poll cycle (default: 5 minutes stale threshold). This is normal on first launch.
