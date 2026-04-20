# TASK-<id>

## Overview

<!-- One sentence: what this task accomplishes and why it matters. -->

---

## Metadata

```
status:       todo
priority:     normal
type:         feature
title:        <short imperative title>
owner:        <agent-id or unassigned>
branch:       agent/<role>-<id>
worktree:     <absolute path to agent's worktree>
depends_on:   []
blocked_by:   []
risk:         low
major_change: no
```

---

## Description

<!-- 
  What specifically needs to be done. Be explicit about:
  - The exact behavior required
  - What inputs the code accepts and what outputs it produces
  - Any constraints (performance, compatibility, API shape)
-->

---

## Scope

Files this agent is authorized to create or modify:

```
files:
  - path/to/file.go
  - path/to/other_file.go
```

Do not edit files outside this list. If you need to touch a file not listed here, message the coordinator.

---

## Acceptance Criteria

```
acceptance:
  - <criterion 1: specific, verifiable>
  - <criterion 2: specific, verifiable>
  - <criterion 3: specific, verifiable>
```

Each criterion must be checkable by running a command, reading a file, or making an HTTP request.

---

## Dependencies

<!-- List any tasks that must be complete before this task can start. -->

```
depends_on: [TASK-001, TASK-002]
```

If a dependency is not yet complete, set your state to `blocked` and message the coordinator.

---

## Constraints

<!-- Any non-obvious rules the agent must follow for this specific task. -->

- Do not change the public API surface of existing functions (backwards compat required).
- Do not add new package-level dependencies.
- Must compile on Go 1.22+.

---

## Notes

```
notes:
  - <any additional context, prior decisions, or warnings>
```

---

## Completion Checklist

Before messaging the coordinator that this task is done:

- [ ] All acceptance criteria met
- [ ] All quality gates pass (build, test, vet/type-check)
- [ ] Changes committed with clear commit messages
- [ ] Final heartbeat written with `state: complete`
- [ ] `completed` event emitted
- [ ] Message sent to coordinator: "TASK-<id> complete: <one-line summary>"
