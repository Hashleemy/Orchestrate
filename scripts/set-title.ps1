param(
    [Parameter(Mandatory)] [string] $AgentId,
    [string] $Role   = $env:AGENT_ROLE,
    [string] $TaskId = $env:TASK_ID,
    [string] $Branch = $env:BRANCH,
    [string] $State  = ""
)

$title = "Agent:$AgentId | $Role | $TaskId | $Branch"
if ($State) {
    $title += " [$State]"
}

$host.UI.RawUI.WindowTitle = $title
