param(
    [Parameter(Mandatory)] [string[]] $ChangedFiles,
    [string] $RepoPath = $env:REPO_ROOT
)

$ErrorActionPreference = "Stop"

$blockedPatterns = @(
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "secrets.*",
    "credentials.*"
)

$lockfileNames = @(
    "go.sum",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "Pipfile.lock"
)

$packageInstallPrefixes = @(
    "npm install",
    "npm i ",
    "pnpm add",
    "yarn add",
    "go get",
    "pip install",
    "cargo add",
    "winget install",
    "choco install"
)

$violations = @()
$warnings   = @()

foreach ($file in $ChangedFiles) {
    $name = Split-Path $file -Leaf

    # Protected file check — hard block
    foreach ($pattern in $blockedPatterns) {
        if ($name -like $pattern) {
            $violations += "BLOCKED protected file: $file (matches pattern '$pattern')"
            break
        }
    }

    # Lockfile check — requires approval
    if ($lockfileNames -contains $name) {
        $warnings += "APPROVAL REQUIRED lockfile modified: $file"
    }
}

if ($violations.Count -gt 0) {
    Write-Host ""
    Write-Host "=== POLICY VIOLATIONS ==="
    foreach ($v in $violations) {
        Write-Error $v
    }
    Write-Host ""
    Write-Host "Commit blocked. Remove protected files and retry."
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "=== POLICY WARNINGS ==="
    foreach ($w in $warnings) {
        Write-Warning $w
    }
    Write-Host ""
    Write-Host "These changes require explicit user approval before pushing."
    Write-Host "Run request-approval.ps1 with trigger 'lockfile_change' to proceed."
    exit 2
}

Write-Host "Policy check passed — no violations found."
exit 0
