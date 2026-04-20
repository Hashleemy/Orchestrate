param(
    [Parameter(Mandatory)] [string] $AgentId,
    [Parameter(Mandatory)] [string] $TaskId,
    [Parameter(Mandatory)] [string] $State,
    [Parameter(Mandatory)] [string] $LastAction,
    [string] $CommsDir = $env:COMMS_DIR,
    [string] $Branch   = $env:BRANCH,
    [string] $Cwd      = (Get-Location).Path
)

if (-not $CommsDir) {
    $CommsDir = Join-Path $env:REPO_ROOT "agent-comms"
}

$statusDir = Join-Path $CommsDir "status"
$null = New-Item -ItemType Directory -Path $statusDir -Force

$data = [ordered]@{
    agent       = $AgentId
    task_id     = $TaskId
    state       = $State
    cwd         = $Cwd
    branch      = $Branch
    last_action = $LastAction
    timestamp   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$json = $data | ConvertTo-Json -Compress
$path = Join-Path $statusDir "$AgentId.json"
Set-Content -Path $path -Value $json -Encoding UTF8

Write-Verbose "Heartbeat written: $path"
