param(
    [Parameter(Mandatory)] [string] $TasksFile,
    [string] $RepoRoot = $PSScriptRoot | Split-Path -Parent,
    [string] $BaseRef  = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TasksFile)) {
    Write-Error "Tasks file not found: $TasksFile"
    exit 1
}

# ── Copy tasks.md into agent-comms/tasks/ ────────────────────────────────────
$tasksDir  = Join-Path $RepoRoot "agent-comms\tasks"
$tasksDest = Join-Path $tasksDir "tasks.md"
$null = New-Item -ItemType Directory -Path $tasksDir -Force
Copy-Item -Path $TasksFile -Destination $tasksDest -Force
Write-Host "Tasks written to: $tasksDest"

# ── Spawn coordinator ─────────────────────────────────────────────────────────
Write-Host "Spawning coordinator agent..."
& "$PSScriptRoot\launch-agent.ps1" `
    -AgentId  "agent-coordinator-01" `
    -Role     "coordinator" `
    -TaskId   "coordinator" `
    -TaskFile $tasksDest `
    -RepoRoot $RepoRoot `
    -BaseRef  $BaseRef

Write-Host ""
Write-Host "Run started. Dashboard: http://localhost:8080"
Write-Host "The coordinator will read tasks.md and spawn worker agents."
