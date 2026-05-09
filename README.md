# Local Agent Orchestrator

A local multi-agent orchestration system that decomposes work into parallel Claude Code sessions, each running in an isolated git worktree, coordinated by a Go backend with a live React dashboard.

The orchestrator itself runs as a single process. It spawns **worker agents** (each a Claude Code CLI session in its own PowerShell window) that operate on a **target repository** of your choosing. Every agent gets its own branch and worktree, so they never collide with each other or your working copy.

---

## What it does

- **Parallel agents** — launch 1–5 worker agents simultaneously, each on its own `agent/<role>-<id>` branch
- **Task graph** — `tasks.md` is the single source of truth; a DAG scheduler promotes tasks only when their dependencies are `done`
- **Checkpoint gates** — orchestration halts at risky operations (major diffs, package installs, sensitive files, protected merges) until you make an explicit choice
- **Live dashboard** — React UI streams agent status, events, approvals, checkpoints, reviews, and per-agent log tails in real time via SSE
- **Policy engine** — classifies diffs as *minor / major / blocked*; auto-raises checkpoints for major or blocked changes and blocks force-pushes outright
- **Code reviews** — spawn a reviewer agent for any worker branch; its verdict (approve/reject/changes-requested) is surfaced in the dashboard before you merge
- **Run history** — completed run metadata persisted to disk and browsable in the UI
- **One-click recovery** — restart dead/stale agents, push approved branches, and merge reviewed branches directly from the dashboard
- **Persistent repo selection** — the target repo path is saved to `~/.orchestrate/config.json` and restored across restarts

---

## Requirements

| Dependency         | Version | Purpose                                                      |
|--------------------|---------|--------------------------------------------------------------|
| Go                 | 1.22+   | Build the orchestrator binary                                |
| Node.js            | 18+     | Build the React dashboard bundle                             |
| Git                | 2.30+   | Worktree support is required                                 |
| Claude Code CLI    | latest  | `claude` must be on PATH — each agent shells out to it       |
| PowerShell         | 7+      | Agent launcher scripts (`scripts/*.ps1`)                     |
| Windows Terminal   | *opt.*  | Named tab support; falls back to plain PS windows            |

> Developed and tested on **Windows 11**. macOS/Linux adapters are not yet implemented — the agent-launch code paths call PowerShell directly.

---

## Install and build

```powershell
git clone https://github.com/Hashleemy/Orchestrate local-agent-orchestrator
cd local-agent-orchestrator
make build
```

`make build` runs `npm install && npm run build` in `web/` (outputs to `internal/uiembed/dist/` where Go embeds it via `//go:embed`), then compiles `orchestrator.exe`.

If you change frontend code, rebuild the bundle **and** restart the Go server — the JS/CSS are baked into the binary at compile time.

### Development mode

Run two terminals:

```powershell
# Terminal 1 — watch & rebuild UI on change
cd web && npm run watch

# Terminal 2 — run the server (rebuilds on each start)
go run ./cmd/orchestrator
```

Watch mode writes a dev-mode bundle to the same embed directory. You still have to restart the server after the bundle updates for changes to appear.

---

## First run

### 1. Start the orchestrator

```powershell
./orchestrator.exe
```

Open **http://localhost:8080** in a browser.

### 2. Point it at a target repository

The top bar shows the current repo path. Click **Change** and paste the absolute path to the git repo you want agents to work on. The path must:

- be an existing directory
- be a git repository (`git init` done, at least one commit exists)
- be writable (agents will create worktrees as siblings at `<repo>/../worktrees/<agent-id>`)

Your selection is saved to `~/.orchestrate/config.json` and restored next launch. You can also set `REPO_ROOT=<path>` as an environment variable to override.

### 3. Start a run

Click **+ Start Run** and either:

- paste `tasks.md` content directly into the textarea, or
- leave it empty to use `agent-comms/tasks/tasks.md` from the target repo (created via the **Add Task** UI)

Choose how many worker agents to launch (1–5). Click **Start Run**.

Each agent opens its own PowerShell window (or Windows Terminal tab), gets a task assigned, and starts writing code in its own worktree. The dashboard updates live.

### 4. Work the queue

As agents run, respond to prompts as they appear:

| Signal in UI           | What to do                                                                 |
|------------------------|----------------------------------------------------------------------------|
| Orange **Checkpoint**  | Agent hit a risky operation. Pick *continue* / *block* / *escalate*.       |
| Yellow **Approval**    | Agent requested an install or touched a sensitive file. Approve or deny.   |
| Red **STALE** / **DEAD** | Heartbeat missed. Click **↺ Restart** on the agent card.                 |
| Agent state `complete` | Click **Diff ▾** to inspect. Click **Start Review** to queue a reviewer.   |
| Review verdict `approve` + `merge_recommendation: ready` | **Merge** button appears on the verdict card. |

### 5. Merge the work back

From each agent card you can:
- **Push** — runs the policy engine first; *minor* diffs push automatically, *major* need approval, *blocked* are denied. Force-push is explicitly disabled.
- **Merge** — available after an approved review. Merges the agent's branch into the target (default `main`), with a dry-run conflict check first.

---

## Tasks.md format

`tasks.md` is a Markdown file with three sections. Example:

```markdown
# Tasks

## Global Rules
- Do not edit files outside your assigned scope
- Request approval for any package installs

## Active Tasks

### TASK-001
status: ready
priority: high
type: feature
title: Implement /api/agents endpoint
owner: agent-backend-01
branch: agent/backend-01
depends_on: []
files:
  - internal/api/handlers.go
acceptance:
  - GET /api/agents returns array of agent status objects
  - go test ./internal/api/... passes
risk: low
```

### Task fields

| Field          | Type         | Required | Notes                                                                 |
|----------------|--------------|----------|-----------------------------------------------------------------------|
| `status`       | enum         | yes      | `todo` / `ready` / `in_progress` / `blocked` / `awaiting_review` / `awaiting_approval` / `done` / `cancelled` |
| `priority`     | enum         | yes      | `low` / `normal` / `high`                                             |
| `type`         | string       | yes      | `feature` / `bug` / `refactor` / etc. — free-form tag                 |
| `title`        | string       | yes      | One-line summary                                                      |
| `owner`        | string       | no       | If set, only that agent will claim it                                 |
| `branch`       | string       | no       | Agent branch name; auto-derived if omitted                            |
| `depends_on`   | `[TASK-NNN]` | no       | Scheduler waits until all deps are `done`                             |
| `blocked_by`   | `[TASK-NNN]` | no       | Explicit block (set by an agent reporting a blocker)                  |
| `files`        | `[path]`     | no       | Declared file scope — agents should not edit outside this             |
| `acceptance`   | `[string]`   | no       | Machine-readable success criteria (shown in review prompts)           |
| `risk`         | enum         | yes      | `low` / `medium` / `high` — feeds the policy classifier               |

Tasks can also be created from the dashboard (**Add Task** button in the task board). The orchestrator auto-assigns IDs in `TASK-NNN` format.

---

## Configuration

| Environment Variable    | Default         | Description                                              |
|-------------------------|-----------------|----------------------------------------------------------|
| `ORCHESTRATOR_ADDR`     | `0.0.0.0:8080`  | Address the HTTP server binds to                         |
| `REPO_ROOT`             | saved config    | Override the target repo path (ignores `~/.orchestrate`) |
| `USE_WINDOWS_TERMINAL`  | `0`             | Set `1` to force Windows Terminal tab mode               |

Persistent state:
- `~/.orchestrate/config.json` — saved repo path
- `<target-repo>/agent-comms/` — runtime communication layer (heartbeats, events, messages, approvals, claims)
- `<target-repo>/../worktrees/<agent-id>/` — per-agent worktree directories

---

## Safety model

- **No autonomous merges** — agents never merge to `main` without an approved review verdict
- **Hard checkpoint gates** — major / blocked changes pause the run until you make a choice
- **No force-push** — `PushBranch` refuses `--force` unconditionally
- **Protected files** — `.env`, `*.pem`, `*.key`, lockfiles, and similar trigger approval requests before the agent proceeds
- **Policy-evaluated pushes** — every push is classified (minor / major / blocked) against the diff before the git command runs
- **Isolated worktrees** — no two agents share a working directory
- **Audit trail** — every agent action is appended to `agent-comms/events/<agent-id>.jsonl`; the dashboard tails it live

---

## Project layout

```
cmd/orchestrator/       entry point
internal/
  api/                  HTTP handlers, router, SSE stream
  approvals/            approval queue service
  comms/                append-only agent communication layer
  config/               persistent config (~/.orchestrate/config.json)
  gitops/               git worktree, branch, merge, diff, push helpers
  models/               shared types
  orchestrator/         coordinator, planner, checkpoints, reviewer, merge, respawn
  parser/               tasks.md parser
  policy/               file and diff classification; push policy
  scheduler/            DAG-based task scheduler
  sessions/             agent launch, process registry, prompt builder, log stream
  tasks/                task state machine
  uiembed/              embeds the built React bundle
scripts/                PowerShell helper scripts (launch-agent.ps1, etc.)
templates/              agent role prompts
web/                    React dashboard source
docs/                   architecture, spec, protocol documentation
agent-comms/            runtime comms directory (created in the target repo)
```

---

## Troubleshooting

**Dashboard shows a blank screen / "Orchestrator" placeholder.**
The React tree crashed and unmounted. Open DevTools → Console to read the error. Common cause: a backend endpoint returned `null` where the UI expects an array. All current endpoints are guarded, but if you're on an older build, rebuild the UI (`cd web && node build.mjs`) and **restart the Go server** — the bundle is embedded at compile time.

**Port 8080 already in use.**
A previous `orchestrator.exe` is still bound. Find the owner and kill it:
```powershell
Get-NetTCPConnection -LocalPort 8080 | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

**Agent card shows DEAD or STALE.**
Heartbeat missed for >5 minutes. Click **↺ Restart** — the orchestrator kills the old PID (if any), spawns a fresh agent on the same task, and re-registers it.

**Push blocked with "approval_required".**
The diff classified as *major*. Review the flagged reasons on the card; if you're intentionally pushing, a **Force push** button appears — it bypasses the diff classifier but still respects checkpoints and the protected-branch list. There is no path to force-push through the policy engine.

**Merge shows conflicts.**
The dry-run detected conflicts against the target branch. Resolve manually in the worktree, commit, then retry.

**"Start Run" does nothing.**
Check the target repo: it must be a git repository with at least one commit. If this is a fresh folder:
```powershell
cd <target-repo>
git init
git add .
git commit -m "initial"
```

**Agents can't find `claude`.**
The CLI must be on PATH in the user's default PowerShell profile, not just the shell you launched the orchestrator from. Verify with:
```powershell
powershell -NoProfile -Command "Get-Command claude"
```

---

## Documentation

| Document                  | Contents                                           |
|---------------------------|----------------------------------------------------|
| `docs/SPEC.md`            | Full system specification                          |
| `docs/ARCHITECTURE.md`    | Component architecture and data flow              |
| `docs/AGENT_PROTOCOL.md`  | Inter-agent communication protocol                |
| `docs/EVENT_MODEL.md`     | Event schema and types                            |
| `docs/POLICY.md`          | Policy engine and approval triggers               |
| `docs/GIT_WORKFLOW.md`    | Branch and worktree conventions                   |
| `docs/UI_SPEC.md`         | Dashboard UI specification                        |
| `docs/setup.md`           | Installation and first-run guide                  |
| `docs/state-machine.md`   | Task and agent state machines                     |
| `CLAUDE.md`               | Instructions loaded by every agent at startup     |

---

## Author

Built by **Hashleemy** — [github.com/Hashleemy](https://github.com/Hashleemy)
