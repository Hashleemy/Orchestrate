param(
    [Parameter(Mandatory)] [string] $AgentId,
    [Parameter(Mandatory)] [string] $TaskId,
    [Parameter(Mandatory)] [ValidateSet(
        "task_started","file_edit","test_run","commit",
        "blocked","unblocked","approval_requested","approval_received",
        "message_sent","message_received","completed","error"
    )] [string] $Type,
    [Parameter(Mandatory)] [string] $Detail,
    [string] $CommsDir = $env:COMMS_DIR
)

if (-not $CommsDir) {
    $CommsDir = Join-Path $env:REPO_ROOT "agent-comms"
}

$eventsDir = Join-Path $CommsDir "events"
$null = New-Item -ItemType Directory -Path $eventsDir -Force

$event = [ordered]@{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    agent     = $AgentId
    task_id   = $TaskId
    type      = $Type
    detail    = $Detail
}

$line = $event | ConvertTo-Json -Compress
$path = Join-Path $eventsDir "$AgentId.jsonl"
Add-Content -Path $path -Value $line -Encoding UTF8

Write-Verbose "Event written [$Type]: $Detail"
