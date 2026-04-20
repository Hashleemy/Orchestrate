param(
    [Parameter(Mandatory)] [string] $AgentId,
    [Parameter(Mandatory)] [string] $TaskId,
    [string] $CommsDir = $env:COMMS_DIR
)

if (-not $CommsDir) {
    $CommsDir = Join-Path $env:REPO_ROOT "agent-comms"
}

$claimsDir = Join-Path $CommsDir "claims"
$null = New-Item -ItemType Directory -Path $claimsDir -Force

$claimFile = Join-Path $claimsDir "$TaskId.json"

if (Test-Path $claimFile) {
    $existing = Get-Content $claimFile -Raw | ConvertFrom-Json
    if ($existing.agent -ne $AgentId) {
        Write-Error "Task $TaskId is already claimed by $($existing.agent). Cannot claim."
        exit 1
    }
    Write-Host "Task $TaskId already claimed by this agent ($AgentId)."
    exit 0
}

$claim = [ordered]@{
    task_id    = $TaskId
    agent      = $AgentId
    claimed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$claim | ConvertTo-Json -Compress | Set-Content -Path $claimFile -Encoding UTF8
Write-Host "Claimed $TaskId for $AgentId."
