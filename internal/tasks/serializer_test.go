package tasks_test

import (
	"strings"
	"testing"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/tasks"
)

func TestSerializeTasks_RoundTrip(t *testing.T) {
	input := []models.Task{
		{
			ID: "TASK-001", Status: models.TaskReady, Priority: "high",
			Type: "feature", Title: "Build parser", Owner: "agent-01",
			Branch: "agent/backend-01", Worktree: "/wt/agent-01",
			DependsOn: []string{}, BlockedBy: []string{},
			Files: []string{"internal/parser/**"}, Acceptance: []string{"Parse tasks"},
			Risk: "low", MajorChange: false,
		},
	}
	out := tasks.SerializeTasks([]string{"Do not edit outside scope"}, input)

	if !strings.Contains(out, "### TASK-001") {
		t.Error("missing task header")
	}
	if !strings.Contains(out, "status: ready") {
		t.Error("missing status")
	}
	if !strings.Contains(out, "owner: agent-01") {
		t.Error("missing owner")
	}
	if !strings.Contains(out, "Do not edit outside scope") {
		t.Error("missing global rule")
	}
	if !strings.Contains(out, "internal/parser/**") {
		t.Error("missing file scope")
	}
}

func TestSerializeTasks_MajorChange(t *testing.T) {
	input := []models.Task{
		{ID: "TASK-002", Status: models.TaskTodo, MajorChange: true},
	}
	out := tasks.SerializeTasks(nil, input)
	if !strings.Contains(out, "major_change: yes") {
		t.Error("expected major_change: yes")
	}
}

func TestSerializeTasks_NoRules(t *testing.T) {
	input := []models.Task{
		{ID: "TASK-003", Status: models.TaskDone},
	}
	out := tasks.SerializeTasks(nil, input)
	if !strings.Contains(out, "### TASK-003") {
		t.Error("missing task")
	}
}
