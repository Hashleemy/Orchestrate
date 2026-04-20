param(
    [Parameter(Mandatory)] [string] $RepoPath,
    [Parameter(Mandatory)] [string] $BranchName,
    [Parameter(Mandatory)] [string] $WorktreePath,
    [string] $BaseRef = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoPath)) {
    Write-Error "Repo path does not exist: $RepoPath"
    exit 1
}

$isRepo = git -C $RepoPath rev-parse --git-dir 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not a git repository: $RepoPath"
    exit 1
}

# Reuse existing worktree if the path already exists and is registered.
$existing = git -C $RepoPath worktree list --porcelain 2>&1 | Select-String "^worktree $WorktreePath"
if ($existing) {
    Write-Host "Worktree already exists at $WorktreePath — reusing."
    exit 0
}

# Create parent directory if needed.
$parent = Split-Path $WorktreePath -Parent
if ($parent -and -not (Test-Path $parent)) {
    $null = New-Item -ItemType Directory -Path $parent -Force
}

# If the branch already exists, add the worktree without -b.
$branchExists = git -C $RepoPath branch --list $BranchName
if ($branchExists) {
    Write-Host "Branch '$BranchName' already exists — checking out into worktree."
    git -C $RepoPath worktree add $WorktreePath $BranchName
} else {
    Write-Host "Creating branch '$BranchName' from '$BaseRef'."
    git -C $RepoPath worktree add -b $BranchName $WorktreePath $BaseRef
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create worktree at $WorktreePath"
    exit 1
}

Write-Host "Worktree ready: $WorktreePath (branch: $BranchName)"
