package orchestrator

import (
	"testing"

	"local-agent-orchestrator/internal/models"
)

func TestNextTaskID_Empty(t *testing.T) {
	id := nextTaskID(nil)
	if id != "TASK-001" {
		t.Errorf("expected TASK-001, got %s", id)
	}
}

func TestNextTaskID_Increments(t *testing.T) {
	tasks := []models.Task{
		{ID: "TASK-001"},
		{ID: "TASK-005"},
		{ID: "TASK-003"},
	}
	id := nextTaskID(tasks)
	if id != "TASK-006" {
		t.Errorf("expected TASK-006, got %s", id)
	}
}

func TestNextTaskID_IgnoresNonNumeric(t *testing.T) {
	tasks := []models.Task{
		{ID: "TASK-002"},
		{ID: "bad-id"},
		{ID: ""},
	}
	id := nextTaskID(tasks)
	if id != "TASK-003" {
		t.Errorf("expected TASK-003, got %s", id)
	}
}
