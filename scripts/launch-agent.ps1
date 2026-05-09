param(
    [Parameter(Mandatory)]  [string] $AgentId,
    [Parameter(Mandatory)]  [string] $Role,
    [Parameter(Mandatory)]  [string] $RepoRoot,
    [string] $TaskId   = "",
    [string] $TaskFile = "",
    [string] $BaseRef  = "main",
    [switch] $PreferWindowsTerminal
)

$ErrorActionPreference = "Stop"

$worktreeBase = Join-Path (Split-Path $RepoRoot -Parent) "worktrees"
$worktreePath = Join-Path $worktreeBase $AgentId

# Coordinator uses a fixed branch name; workers use agent/<role>-<id>
if ($Role -eq "coordinator") {
    $branch = "agent/coordinator"
} else {
    $branch = "agent/$Role-$($AgentId -replace '^agent-[a-z]+-','')"
}

# ── Create worktree ──────────────────────────────────────────────────────────
if (-not (Test-Path $worktreePath)) {
    Write-Host "Creating worktree: $worktreePath on branch $branch"
    $null = New-Item -ItemType Directory -Path $worktreeBase -Force
    git -C $RepoRoot worktree add -b $branch $worktreePath $BaseRef 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Branch may already exist — try without -b
        git -C $RepoRoot worktree add $worktreePath $branch 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create worktree for $AgentId"
            exit 1
        }
    }
} else {
    Write-Host "Worktree already exists: $worktreePath"
}

# ── Copy task file into worktree (workers only) ──────────────────────────────
if ($Role -ne "coordinator" -and $TaskFile -ne "") {
    $taskDest = Join-Path $worktreePath "TASK.md"
    Copy-Item -Path $TaskFile -Destination $taskDest -Force
}

# ── Build bootstrap message ──────────────────────────────────────────────────
$commsDir = Join-Path $RepoRoot "agent-comms"

if ($Role -eq "coordinator") {
    $bootstrap = @"
You are the COORDINATOR agent for this run. Your agent ID is $AgentId.

Your project goal is described in: $commsDir\project-goal.md
Your role instructions are in:    $worktreePath\templates\roles\coordinator.md
The communication hub is at:      $commsDir
The repo root is:                 $RepoRoot

IMPORTANT — READ THIS CAREFULLY:
You must loop continuously until the entire project goal is achieved. Do NOT stop after the first batch of tasks.

Your startup sequence:
1. Read CLAUDE.md (in this worktree root).
2. Read templates/roles/coordinator.md — your full role instructions and core loop.
3. Read agent-comms/project-goal.md — the user's project description (your north star).
4. Read agent-comms/tasks/ to understand any work already done.
5. Generate the first batch of tasks (3-5 tasks). Write each as agent-comms/tasks/TASK-<id>.md.
6. Spawn a worker agent for each task using: .\scripts\launch-agent.ps1
7. Monitor progress. When tasks complete, assess: is the project goal met?
8. If NO — generate more tasks and spawn more workers. Repeat.
9. If YES — announce completion.

Never stop working until the project is genuinely done.
"@
} else {
    $bootstrap = @"
You are a WORKER agent. Your agent ID is $AgentId, role: $Role, task: $TaskId.

Your task file is at: $worktreePath\TASK.md
Your role file is at: $worktreePath\templates\roles\$Role.md
The communication hub is at: $commsDir
Your branch is: $branch

Startup sequence:
1. Read CLAUDE.md (in this worktree root).
2. Read templates/roles/$Role.md for your role instructions.
3. Read TASK.md — your specific task, acceptance criteria, and file scope.
4. Claim your task by writing: agent-comms/claims/TASK-$TaskId.json
5. Begin work. Write heartbeats to agent-comms/status/$AgentId.json every 60 seconds.
6. When done, commit your changes, message the coordinator, and set your state to complete.
"@
}

# ── Build agent startup script (temp file avoids quoting issues) ─────────────
$title    = if ($Role -eq "coordinator") { "Coordinator | $AgentId" } else { "Agent:$AgentId | $Role | $TaskId | $branch" }
$tempDir  = [System.IO.Path]::GetTempPath()
$tempScript = Join-Path $tempDir "agent-$AgentId-$PID.ps1"

# Escape single quotes in bootstrap for embedding in here-string
$bootstrapEscaped = $bootstrap -replace "'", "''"

@"
`$host.UI.RawUI.WindowTitle = '$title'
Set-Location '$worktreePath'
`$env:AGENT_ID   = '$AgentId'
`$env:AGENT_ROLE = '$Role'
`$env:TASK_ID    = '$TaskId'
`$env:TASK_FILE  = 'TASK.md'
`$env:COMMS_DIR  = '$commsDir'
`$env:REPO_ROOT  = '$RepoRoot'
`$env:BRANCH     = '$branch'

Write-Host '$title'
Write-Host ""

claude --dangerously-skip-permissions -p '$bootstrapEscaped'
"@ | Set-Content -Path $tempScript -Encoding UTF8

# ── Detect Windows Terminal ──────────────────────────────────────────────────
$wtExe = Get-Command wt.exe -ErrorAction SilentlyContinue
$useWT = ($PreferWindowsTerminal -or ($null -ne $wtExe)) -and ($null -ne $wtExe)

if ($useWT) {
    $wtArgs = @("--window", "0", "new-tab", "--title", $title,
                "powershell", "-NoExit", "-File", $tempScript)
    Start-Process wt.exe -ArgumentList $wtArgs
    Write-Host "Launched $AgentId in Windows Terminal tab: $title"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-File", $tempScript
    Write-Host "Launched $AgentId in PowerShell window (Windows Terminal not found)."
}
