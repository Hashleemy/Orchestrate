param(
    [Parameter(Mandatory)]  [string] $AgentId,
    [Parameter(Mandatory)]  [string] $Role,
    [Parameter(Mandatory)]  [string] $TaskId,
    [Parameter(Mandatory)]  [string] $TaskFile,
    [Parameter(Mandatory)]  [string] $RepoRoot,
    [string] $BaseRef = "main",
    [switch] $PreferWindowsTerminal   # force WT even when auto-detect would skip
)

$ErrorActionPreference = "Stop"

$worktreeBase = Join-Path (Split-Path $RepoRoot -Parent) "worktrees"
$worktreePath = Join-Path $worktreeBase $AgentId
$branch       = "agent/$Role-$($AgentId -replace '^agent-[a-z]+-','')"

# ── Create worktree ──────────────────────────────────────────────────────────
if (-not (Test-Path $worktreePath)) {
    Write-Host "Creating worktree: $worktreePath on branch $branch"
    $null = New-Item -ItemType Directory -Path $worktreeBase -Force
    git -C $RepoRoot worktree add -b $branch $worktreePath $BaseRef 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create worktree for $AgentId"
        exit 1
    }
} else {
    Write-Host "Worktree already exists: $worktreePath"
}

# ── Copy task file into worktree ─────────────────────────────────────────────
$taskDest = Join-Path $worktreePath "TASK.md"
Copy-Item -Path $TaskFile -Destination $taskDest -Force

# ── Build agent startup script (temp file avoids quoting issues) ─────────────
$title    = "Agent:$AgentId | $Role | $TaskId | $branch"
$commsDir = Join-Path $RepoRoot "agent-comms"
$tempDir  = [System.IO.Path]::GetTempPath()
$tempScript = Join-Path $tempDir "agent-$AgentId-$PID.ps1"

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
Write-Host "Agent $AgentId starting -- role: $Role, task: $TaskId"
Write-Host "Worktree: $worktreePath"
Write-Host "Branch:   $branch"
Write-Host ""
Write-Host "Read CLAUDE.md then your role file (templates/roles/$Role.md), then TASK.md"
Write-Host ""
claude
"@ | Set-Content -Path $tempScript -Encoding UTF8

# ── Detect Windows Terminal ──────────────────────────────────────────────────
$wtExe = Get-Command wt.exe -ErrorAction SilentlyContinue
$useWT = ($PreferWindowsTerminal -or ($null -ne $wtExe)) -and ($null -ne $wtExe)

if ($useWT) {
    # All agents share one WT window (--window 0 = most-recently-used window).
    # Each agent gets its own tab named after the agent ID and task.
    $wtArgs = @("--window", "0", "new-tab", "--title", $title,
                "powershell", "-NoExit", "-File", $tempScript)
    Start-Process wt.exe -ArgumentList $wtArgs
    Write-Host "Launched $AgentId in Windows Terminal tab: $title"
} else {
    # Fall back to a standalone PowerShell window
    Start-Process powershell -ArgumentList "-NoExit", "-File", $tempScript
    Write-Host "Launched $AgentId in PowerShell window (Windows Terminal not found)."
}
