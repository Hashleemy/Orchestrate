package scheduler_test

import (
	"testing"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/scheduler"
)

func tasks(pairs ...string) []models.Task {
	// pairs: id, dep, dep, ... | id, dep ...  (separated by "|")
	// Simple helper: each arg is "id" or "id:dep1,dep2"
	var out []models.Task
	for _, p := range pairs {
		t := models.Task{Status: models.TaskTodo}
		if len(p) > 0 && p[0] != ':' {
			// find colon
			colon := -1
			for i, c := range p {
				if c == ':' {
					colon = i
					break
				}
			}
			if colon == -1 {
				t.ID = p
			} else {
				t.ID = p[:colon]
				deps := p[colon+1:]
				if deps != "" {
					t.DependsOn = splitComma(deps)
				}
			}
		}
		out = append(out, t)
	}
	return out
}

func splitComma(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if part := s[start:i]; part != "" {
				out = append(out, part)
			}
			start = i + 1
		}
	}
	return out
}

func TestDetectCycle_NoCycle(t *testing.T) {
	ts := tasks("TASK-001", "TASK-002:TASK-001", "TASK-003:TASK-002")
	if err := scheduler.DetectCycle(ts); err != nil {
		t.Errorf("expected no cycle, got: %v", err)
	}
}

func TestDetectCycle_DirectCycle(t *testing.T) {
	ts := []models.Task{
		{ID: "A", DependsOn: []string{"B"}, Status: models.TaskTodo},
		{ID: "B", DependsOn: []string{"A"}, Status: models.TaskTodo},
	}
	if err := scheduler.DetectCycle(ts); err == nil {
		t.Error("expected cycle error, got nil")
	}
}

func TestDetectCycle_SelfDependency(t *testing.T) {
	ts := []models.Task{
		{ID: "A", DependsOn: []string{"A"}, Status: models.TaskTodo},
	}
	if err := scheduler.DetectCycle(ts); err == nil {
		t.Error("expected self-dependency to be detected as cycle")
	}
}

func TestReadyIDs_AllDepsDone(t *testing.T) {
	ts := []models.Task{
		{ID: "TASK-001", Status: models.TaskDone},
		{ID: "TASK-002", Status: models.TaskTodo, DependsOn: []string{"TASK-001"}},
		{ID: "TASK-003", Status: models.TaskTodo, DependsOn: []string{"TASK-002"}},
	}
	ready := scheduler.ReadyIDs(ts)
	if len(ready) != 1 || ready[0] != "TASK-002" {
		t.Errorf("expected [TASK-002], got %v", ready)
	}
}

func TestReadyIDs_NoDeps(t *testing.T) {
	ts := []models.Task{
		{ID: "TASK-001", Status: models.TaskTodo},
		{ID: "TASK-002", Status: models.TaskTodo},
	}
	ready := scheduler.ReadyIDs(ts)
	if len(ready) != 2 {
		t.Errorf("expected 2 ready tasks, got %v", ready)
	}
}

func TestReadyIDs_BlockedByInProgress(t *testing.T) {
	ts := []models.Task{
		{ID: "TASK-001", Status: models.TaskInProgress},
		{ID: "TASK-002", Status: models.TaskTodo, DependsOn: []string{"TASK-001"}},
	}
	ready := scheduler.ReadyIDs(ts)
	if len(ready) != 0 {
		t.Errorf("expected 0 ready tasks when dep is in_progress, got %v", ready)
	}
}
