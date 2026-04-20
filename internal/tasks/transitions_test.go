package tasks_test

import (
	"testing"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/tasks"
)

func TestValidTransitions(t *testing.T) {
	valid := [][2]models.TaskStatus{
		{models.TaskTodo, models.TaskReady},
		{models.TaskReady, models.TaskInProgress},
		{models.TaskReady, models.TaskCancelled},
		{models.TaskInProgress, models.TaskBlocked},
		{models.TaskInProgress, models.TaskAwaitingReview},
		{models.TaskInProgress, models.TaskAwaitingApproval},
		{models.TaskInProgress, models.TaskCancelled},
		{models.TaskBlocked, models.TaskReady},
		{models.TaskAwaitingReview, models.TaskDone},
		{models.TaskAwaitingReview, models.TaskInProgress},
		{models.TaskAwaitingApproval, models.TaskReady},
	}
	for _, pair := range valid {
		if err := tasks.ValidateTransition(pair[0], pair[1]); err != nil {
			t.Errorf("expected valid transition %s→%s, got error: %v", pair[0], pair[1], err)
		}
	}
}

func TestInvalidTransitions(t *testing.T) {
	invalid := [][2]models.TaskStatus{
		{models.TaskTodo, models.TaskDone},
		{models.TaskTodo, models.TaskInProgress},
		{models.TaskDone, models.TaskTodo},
		{models.TaskCancelled, models.TaskReady},
		{models.TaskReady, models.TaskDone},
	}
	for _, pair := range invalid {
		if err := tasks.ValidateTransition(pair[0], pair[1]); err == nil {
			t.Errorf("expected invalid transition %s→%s to fail", pair[0], pair[1])
		}
	}
}

func TestSameStatusIsNoOp(t *testing.T) {
	statuses := []models.TaskStatus{
		models.TaskTodo, models.TaskReady, models.TaskInProgress,
		models.TaskBlocked, models.TaskDone, models.TaskCancelled,
	}
	for _, s := range statuses {
		if err := tasks.ValidateTransition(s, s); err != nil {
			t.Errorf("same-status transition %s→%s should be a no-op, got: %v", s, s, err)
		}
	}
}
