param(
    [Parameter(Mandatory)] [string] $AgentId,
    [Parameter(Mandatory)] [string] $TaskId,
    [Parameter(Mandatory)] [ValidateSet(
        "package_install","lockfile_change","sensitive_file",
        "protected_merge","major_change","destructive_delete","network_deploy"
    )] [string] $Trigger,
    [Parameter(Mandatory)] [string] $Detail,
    [string] $CommsDir  = $env:COMMS_DIR,
    [int]    $PollSecs  = 30,
    [int]    $TimeoutMin = 30
)

if (-not $CommsDir) {
    $CommsDir = Join-Path $env:REPO_ROOT "agent-comms"
}

$approvalsDir = Join-Path $CommsDir "approvals"
$null = New-Item -ItemType Directory -Path $approvalsDir -Force

$ts        = (Get-Date).ToUniversalTime()
$requestId = "$AgentId-$($ts.ToFileTimeUtc())"
$filePath  = Join-Path $approvalsDir "$requestId.json"

$request = [ordered]@{
    id          = $requestId
    trigger     = $Trigger
    agent       = $AgentId
    task_id     = $TaskId
    detail      = $Detail
    status      = "pending"
    created_at  = $ts.ToString("yyyy-MM-ddTHH:mm:ssZ")
    resolved_at = $null
}

$request | ConvertTo-Json | Set-Content -Path $filePath -Encoding UTF8
Write-Host "Approval requested: $requestId"
Write-Host "Trigger: $Trigger"
Write-Host "Detail:  $Detail"
Write-Host "Waiting for approval (timeout: $TimeoutMin min, polling every $PollSecs s)..."

# Update heartbeat
& "$PSScriptRoot\heartbeat.ps1" `
    -AgentId   $AgentId `
    -TaskId    $TaskId `
    -State     "awaiting_approval" `
    -LastAction "approval requested: $Trigger — $Detail" `
    -CommsDir  $CommsDir

# Write event
& "$PSScriptRoot\write-event.ps1" `
    -AgentId  $AgentId `
    -TaskId   $TaskId `
    -Type     "approval_requested" `
    -Detail   "requested approval for $Trigger`: $Detail" `
    -CommsDir $CommsDir

$deadline = (Get-Date).AddMinutes($TimeoutMin)

while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds $PollSecs

    $current = Get-Content $filePath -Raw | ConvertFrom-Json
    if ($current.status -eq "approved") {
        Write-Host "APPROVED: proceeding with $Detail"

        & "$PSScriptRoot\write-event.ps1" `
            -AgentId  $AgentId `
            -TaskId   $TaskId `
            -Type     "approval_received" `
            -Detail   "approval APPROVED for $Trigger`: $Detail" `
            -CommsDir $CommsDir

        exit 0
    }
    if ($current.status -eq "denied") {
        Write-Warning "DENIED: cannot proceed with $Detail"

        & "$PSScriptRoot\write-event.ps1" `
            -AgentId  $AgentId `
            -TaskId   $TaskId `
            -Type     "approval_received" `
            -Detail   "approval DENIED for $Trigger`: $Detail" `
            -CommsDir $CommsDir

        exit 1
    }

    Write-Host "Still pending... ($([int]($deadline - (Get-Date)).TotalMinutes) min remaining)"
}

Write-Error "Approval request timed out after $TimeoutMin minutes: $requestId"
exit 2
