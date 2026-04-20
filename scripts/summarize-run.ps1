param(
    [string] $CommsDir  = $env:COMMS_DIR,
    [string] $RepoRoot  = $env:REPO_ROOT,
    [switch] $Json
)

$ErrorActionPreference = "Stop"

if (-not $CommsDir) {
    $CommsDir = Join-Path $RepoRoot "agent-comms"
}

if (-not (Test-Path $CommsDir)) {
    Write-Error "Comms directory not found: $CommsDir"
    exit 1
}

# ── Collect agent statuses ────────────────────────────────────────────────────
$statusDir  = Join-Path $CommsDir "status"
$statuses   = @()
if (Test-Path $statusDir) {
    Get-ChildItem $statusDir -Filter "*.json" | ForEach-Object {
        $s = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $statuses += $s
    }
}

# ── Collect tasks from live tasks.md ─────────────────────────────────────────
$tasksFile = Join-Path $CommsDir "tasks\tasks.md"
$taskLines = @()
if (Test-Path $tasksFile) {
    $taskLines = Get-Content $tasksFile
}

$done       = @($taskLines | Select-String "^status:\s*done"        | Measure-Object).Count
$inProgress = @($taskLines | Select-String "^status:\s*in_progress" | Measure-Object).Count
$blocked    = @($taskLines | Select-String "^status:\s*blocked"     | Measure-Object).Count
$ready      = @($taskLines | Select-String "^status:\s*ready"       | Measure-Object).Count
$todo       = @($taskLines | Select-String "^status:\s*todo"        | Measure-Object).Count

# ── Collect pending approvals ─────────────────────────────────────────────────
$approvalsDir = Join-Path $CommsDir "approvals"
$pendingApprovals = @()
if (Test-Path $approvalsDir) {
    Get-ChildItem $approvalsDir -Filter "*.json" | ForEach-Object {
        $a = Get-Content $_.FullName -Raw | ConvertFrom-Json
        if ($a.status -eq "pending") {
            $pendingApprovals += $a
        }
    }
}

# ── Collect pending checkpoints ───────────────────────────────────────────────
$checkpointsDir = Join-Path $CommsDir "checkpoints"
$pendingCheckpoints = @()
if (Test-Path $checkpointsDir) {
    Get-ChildItem $checkpointsDir -Filter "*.json" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw | ConvertFrom-Json
        if ($c.status -eq "pending") {
            $pendingCheckpoints += $c
        }
    }
}

# ── Collect recent events ─────────────────────────────────────────────────────
$eventsDir   = Join-Path $CommsDir "events"
$recentEvents = @()
if (Test-Path $eventsDir) {
    Get-ChildItem $eventsDir -Filter "*.jsonl" | ForEach-Object {
        Get-Content $_.FullName | Select-Object -Last 5 | ForEach-Object {
            try { $recentEvents += ($_ | ConvertFrom-Json) } catch {}
        }
    }
    $recentEvents = $recentEvents | Sort-Object timestamp | Select-Object -Last 10
}

# ── JSON output ───────────────────────────────────────────────────────────────
if ($Json) {
    [ordered]@{
        tasks = [ordered]@{
            done        = $done
            in_progress = $inProgress
            blocked     = $blocked
            ready       = $ready
            todo        = $todo
        }
        agents             = $statuses
        pending_approvals  = $pendingApprovals
        pending_checkpoints = $pendingCheckpoints
        recent_events      = $recentEvents
    } | ConvertTo-Json -Depth 6
    exit 0
}

# ── Human-readable output ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║         ORCHESTRATION SUMMARY        ║"
Write-Host "╚══════════════════════════════════════╝"
Write-Host ""

Write-Host "── Tasks ────────────────────────────────"
Write-Host "  Done:        $done"
Write-Host "  In Progress: $inProgress"
Write-Host "  Ready:       $ready"
Write-Host "  Blocked:     $blocked"
Write-Host "  Todo:        $todo"
Write-Host ""

if ($statuses.Count -gt 0) {
    Write-Host "── Agents ───────────────────────────────"
    foreach ($s in $statuses) {
        $staleTag = if ($s.stale) { " [STALE]" } else { "" }
        Write-Host "  $($s.agent) | $($s.state)$staleTag | task: $($s.task_id) | $($s.last_action)"
    }
    Write-Host ""
}

if ($pendingApprovals.Count -gt 0) {
    Write-Host "── Pending Approvals ────────────────────"
    foreach ($a in $pendingApprovals) {
        Write-Host "  [$($a.id)] $($a.trigger) — $($a.detail)"
    }
    Write-Host ""
}

if ($pendingCheckpoints.Count -gt 0) {
    Write-Host "── Checkpoints Requiring Attention ──────"
    foreach ($c in $pendingCheckpoints) {
        Write-Host "  [$($c.id)] $($c.kind) — $($c.detail)"
        if ($c.next_steps) {
            foreach ($step in $c.next_steps) {
                Write-Host "    → $step"
            }
        }
    }
    Write-Host ""
}

if ($recentEvents.Count -gt 0) {
    Write-Host "── Recent Events ────────────────────────"
    foreach ($e in $recentEvents) {
        Write-Host "  $($e.timestamp) [$($e.agent)] $($e.type): $($e.detail)"
    }
    Write-Host ""
}

# ── Next-step recommendations ─────────────────────────────────────────────────
Write-Host "── Recommended Next Steps ───────────────"
if ($pendingCheckpoints.Count -gt 0) {
    Write-Host "  1. Resolve $($pendingCheckpoints.Count) pending checkpoint(s) before continuing."
}
if ($pendingApprovals.Count -gt 0) {
    Write-Host "  2. Approve or deny $($pendingApprovals.Count) pending operation(s) in the UI."
}
if ($blocked -gt 0) {
    Write-Host "  3. Investigate $blocked blocked task(s) and unblock or reassign."
}
if ($ready -gt 0 -and $inProgress -eq 0) {
    Write-Host "  4. Assign $ready ready task(s) to available agents."
}
if ($inProgress -gt 0) {
    Write-Host "  5. Wait for $inProgress in-progress task(s), then review diffs before merging."
}
if ($done -gt 0 -and $inProgress -eq 0 -and $ready -eq 0 -and $blocked -eq 0) {
    Write-Host "  All active tasks complete — review merged changes and plan the next phase."
}
Write-Host ""
