package parser_test

import (
	"strings"
	"testing"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/parser"
)

const sampleTasks = `
## Global Rules
- Workers may propose task additions.
- Only the coordinator may apply final changes.

## Active Tasks

### TASK-001
status: ready
priority: high
type: feature
title: Build parser
owner: agent-01
branch: agent/backend-01
worktree: /worktrees/agent-01
depends_on: []
blocked_by: []
files:
  - internal/parser/**
acceptance:
  - Parse task blocks
  - Validate required fields
risk: low
major_change: no
notes:
  - Keep it readable

### TASK-002
status: todo
priority: medium
type: feature
title: Build worktree manager
owner: unassigned
branch: none
worktree: none
depends_on: [TASK-001]
blocked_by: []
files:
  - internal/gitops/**
acceptance:
  - Create worktrees
risk: medium
major_change: no
`

func TestParse_TaskCount(t *testing.T) {
	list, err := parser.Parse(sampleTasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.Tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(list.Tasks))
	}
}

func TestParse_GlobalRules(t *testing.T) {
	list, err := parser.Parse(sampleTasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.GlobalRules) != 2 {
		t.Errorf("expected 2 global rules, got %d", len(list.GlobalRules))
	}
}

func TestParse_FieldValues(t *testing.T) {
	list, err := parser.Parse(sampleTasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	t1 := list.Tasks[0]
	if t1.ID != "TASK-001" {
		t.Errorf("expected TASK-001, got %s", t1.ID)
	}
	if t1.Status != models.TaskReady {
		t.Errorf("expected ready, got %s", t1.Status)
	}
	if t1.Priority != "high" {
		t.Errorf("expected high priority, got %s", t1.Priority)
	}
	if t1.Owner != "agent-01" {
		t.Errorf("expected agent-01 owner, got %s", t1.Owner)
	}
	if t1.MajorChange {
		t.Error("expected major_change=false")
	}
}

func TestParse_MultilineFields(t *testing.T) {
	list, err := parser.Parse(sampleTasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	t1 := list.Tasks[0]
	if len(t1.Files) != 1 || t1.Files[0] != "internal/parser/**" {
		t.Errorf("unexpected files: %v", t1.Files)
	}
	if len(t1.Acceptance) != 2 {
		t.Errorf("expected 2 acceptance criteria, got %d", len(t1.Acceptance))
	}
	if len(t1.Notes) != 1 {
		t.Errorf("expected 1 note, got %d", len(t1.Notes))
	}
}

func TestParse_DependsOn(t *testing.T) {
	list, err := parser.Parse(sampleTasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	t2 := list.Tasks[1]
	if len(t2.DependsOn) != 1 || t2.DependsOn[0] != "TASK-001" {
		t.Errorf("unexpected depends_on: %v", t2.DependsOn)
	}
}

func TestParse_EmptyInput(t *testing.T) {
	list, err := parser.Parse("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.Tasks) != 0 {
		t.Errorf("expected 0 tasks for empty input, got %d", len(list.Tasks))
	}
}

func TestParse_CRLFLineEndings(t *testing.T) {
	crlf := strings.ReplaceAll(sampleTasks, "\n", "\r\n")
	list, err := parser.Parse(crlf)
	if err != nil {
		t.Fatalf("CRLF: %v", err)
	}
	if len(list.Tasks) != 2 {
		t.Errorf("CRLF: expected 2 tasks, got %d", len(list.Tasks))
	}
	if list.Tasks[0].Status != models.TaskReady {
		t.Errorf("CRLF: expected ready status, got %q", list.Tasks[0].Status)
	}
}

func TestParse_BOMPrefix(t *testing.T) {
	bom := "\xEF\xBB\xBF" + sampleTasks
	list, err := parser.Parse(bom)
	if err != nil {
		t.Fatalf("BOM: %v", err)
	}
	if len(list.Tasks) != 2 {
		t.Errorf("BOM: expected 2 tasks, got %d", len(list.Tasks))
	}
}

func TestParse_TrailingWhitespaceInTitle(t *testing.T) {
	input := "## Active Tasks\n\n### TASK-001\nstatus: ready\ntitle: Build parser   \nowner: agent-01\n"
	list, err := parser.Parse(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.Tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(list.Tasks))
	}
	if list.Tasks[0].Title != "Build parser" {
		t.Errorf("title: want %q, got %q", "Build parser", list.Tasks[0].Title)
	}
}

func TestParse_AdjacentSectionsNoBlanks(t *testing.T) {
	input := "## Active Tasks\n### TASK-001\nstatus: ready\ntitle: First\n### TASK-002\nstatus: todo\ntitle: Second\n"
	list, err := parser.Parse(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.Tasks) != 2 {
		t.Errorf("expected 2 tasks from adjacent sections, got %d", len(list.Tasks))
	}
}

func TestParse_UnknownKeysIgnored(t *testing.T) {
	input := "## Active Tasks\n\n### TASK-001\nstatus: ready\ntitle: T\nfuture_field: some value\nanother_unknown: 42\n"
	list, err := parser.Parse(input)
	if err != nil {
		t.Fatalf("unexpected error on unknown keys: %v", err)
	}
	if len(list.Tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(list.Tasks))
	}
	if list.Tasks[0].Title != "T" {
		t.Errorf("known fields still parsed: want title %q, got %q", "T", list.Tasks[0].Title)
	}
}

func TestParse_MissingStatusContinues(t *testing.T) {
	// Task without status: should still parse remaining fields and not fail
	input := "## Active Tasks\n\n### TASK-001\ntitle: No Status Task\nowner: agent-01\n\n### TASK-002\nstatus: todo\ntitle: With Status\n"
	list, err := parser.Parse(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.Tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(list.Tasks))
	}
	if list.Tasks[1].Status != models.TaskTodo {
		t.Errorf("TASK-002 status: want todo, got %q", list.Tasks[1].Status)
	}
}
