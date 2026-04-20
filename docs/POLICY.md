# Policy

## Principles

1. **Least privilege**: agents do only what their task requires.
2. **Explicit approval**: any action with meaningful side effects beyond the repo requires human sign-off.
3. **Auditability**: every restricted action attempt is logged, whether approved or denied.
4. **Fail closed**: if in doubt about whether an action needs approval, request it.

---

## Auto-Allowed Actions

These require no approval and no special logging beyond the normal event stream:

- Reading any file in the repo
- Editing files within your assigned scope
- Running tests (`go test`, `npm test`, `pytest`, etc.)
- Running linters and type checkers
- `git add`, `git commit`, `git diff`, `git log`, `git status`
- Writing to `agent-comms/` (status, events, messages)
- Sending inter-agent messages

---

## Hard-Blocked Actions (Require Approval)

### `package_install`
Any command that adds a new dependency to the project:

```
npm install <pkg>      npm i <pkg>
yarn add <pkg>         pnpm add <pkg>
go get <pkg>           pip install <pkg>
cargo add <pkg>        winget install <pkg>
choco install <pkg>    apt install <pkg>
```

**Why**: introduces third-party code, modifies lockfiles, may introduce vulnerabilities.

---

### `lockfile_change`
Direct edits to lockfiles:

```
go.sum
package-lock.json
yarn.lock
pnpm-lock.yaml
Cargo.lock
Pipfile.lock
```

**Why**: lockfiles are the ground truth for reproducible builds; unreviewed changes break this.

---

### `sensitive_file`
Any write to files matching:

```
.env          .env.*        .env.local
*.pem         *.key         *.p12       *.pfx
secrets.*     credentials.* *.secret
```

**Why**: risk of leaking secrets; these files must never be committed.

---

### `protected_merge`
Any merge or push that targets:

```
main      master      integration     release/*
```

**Why**: these branches are shared; merges must be reviewed by the coordinator.

---

### `major_change`
Actions flagged as architectural in the task file (`major_change: yes` or `risk: high`):

- Rewriting authentication or authorization
- Changing the database schema
- Replacing a core library or framework
- Modifying CI/CD pipelines
- Changing build configuration

**Why**: high blast radius; must be reviewed before execution.

---

### `destructive_delete`
Operations that delete content permanently:

```
rm -rf           git clean -f
DROP TABLE       DELETE FROM ... (unscoped)
Clear-Host -Force (filesystem wipes)
```

**Why**: irreversible without a backup.

---

### `network_deploy`
Operations that push to remote systems or trigger deployments:

```
git push         gh release create
kubectl apply    docker push
az deploy        aws cloudformation deploy
vercel deploy    netlify deploy
```

**Why**: affects shared infrastructure or external users.

---

## Approval Request Flow

```
Agent detects restricted action needed
  └─▶ Write agent-comms/approvals/<agent-id>-<timestamp>.json
        {
          "id": "<agent-id>-<timestamp>",
          "trigger": "<trigger-type>",
          "agent": "<agent-id>",
          "task_id": "<task-id>",
          "detail": "<exact command or file path>",
          "status": "pending",
          "created_at": "<ISO>"
        }
  └─▶ Update heartbeat: state = awaiting_approval
  └─▶ Emit event: approval_requested
  └─▶ STOP — poll file every 30s

Dashboard shows approval card to user
  └─▶ User clicks Approve or Deny
        Orchestrator updates file:
        { "status": "approved", "resolved_at": "<ISO>" }
        or
        { "status": "denied", "resolved_at": "<ISO>" }

Agent detects status change
  └─▶ Emit event: approval_received
  ├─▶ If approved: proceed with action, resume normal state
  └─▶ If denied: log denial, message coordinator, await guidance
```

---

## Policy Enforcement in Go

The following functions in `internal/policy` implement enforcement:

| Function | File | Purpose |
|----------|------|---------|
| `RequiresApproval(command)` | `commands.go` | Detects install commands |
| `IsLockfile(path)` | `rules.go` | Detects lockfile paths |
| `IsProtectedPath(path)` | `protected.go` | Detects secret file paths |
| `IsMajorChange(task)` | `classifier.go` | Detects high-risk tasks |

These are used by the API when agents submit pre-action checks, and by the coordinator when reviewing commits.

---

## Scope Violations

If an agent edits a file outside its declared scope:

1. The coordinator should flag this on review.
2. The affected file should be reverted in the agent's worktree.
3. The task is returned to `in_progress` with a note explaining the boundary violation.

Scope is defined by the `files:` list in the task file and the boundaries in the role file.
