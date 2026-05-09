package scheduler_test

import (
	"fmt"
	"testing"
	"time"

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

func TestDetectCycle_ThreeNodeCycle(t *testing.T) {
	ts := []models.Task{
		{ID: "A", DependsOn: []string{"B"}, Status: models.TaskTodo},
		{ID: "B", DependsOn: []string{"C"}, Status: models.TaskTodo},
		{ID: "C", DependsOn: []string{"A"}, Status: models.TaskTodo},
	}
	if err := scheduler.DetectCycle(ts); err == nil {
		t.Error("expected 3-node cycle error, got nil")
	}
}

func TestReadyIDs_DiamondDependency(t *testing.T) {
	// A→B, A→C, B→D, C→D; B is done, C is not — D must wait for C
	ts := []models.Task{
		{ID: "A", Status: models.TaskDone},
		{ID: "B", Status: models.TaskDone, DependsOn: []string{"A"}},
		{ID: "C", Status: models.TaskTodo, DependsOn: []string{"A"}},
		{ID: "D", Status: models.TaskTodo, DependsOn: []string{"B", "C"}},
	}
	ready := scheduler.ReadyIDs(ts)
	if len(ready) != 1 || ready[0] != "C" {
		t.Errorf("diamond: expected [C] ready (D must wait for C), got %v", ready)
	}
}

func TestReadyIDs_AllParentsMustBeDone(t *testing.T) {
	ts := []models.Task{
		{ID: "A", Status: models.TaskDone},
		{ID: "B", Status: models.TaskInProgress},
		{ID: "C", Status: models.TaskTodo, DependsOn: []string{"A", "B"}},
	}
	ready := scheduler.ReadyIDs(ts)
	if len(ready) != 0 {
		t.Errorf("expected 0 ready (B not done), got %v", ready)
	}
	ts[1].Status = models.TaskDone
	ready = scheduler.ReadyIDs(ts)
	if len(ready) != 1 || ready[0] != "C" {
		t.Errorf("expected [C] once both parents done, got %v", ready)
	}
}

func TestReadyIDs_BlockedByDoesNotGateScheduling(t *testing.T) {
	// blocked_by is informational only; ReadyIDs should not use it
	ts := []models.Task{
		{ID: "A", Status: models.TaskTodo, DependsOn: []string{}, BlockedBy: []string{"B"}},
		{ID: "B", Status: models.TaskInProgress},
	}
	ready := scheduler.ReadyIDs(ts)
	found := false
	for _, id := range ready {
		if id == "A" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected A ready (blocked_by not gating), got %v", ready)
	}
}

func TestReadyIDs_LargeDAG(t *testing.T) {
	const n = 1000
	ts := make([]models.Task, n)
	ts[0] = models.Task{ID: "T0", Status: models.TaskDone}
	for i := 1; i < n; i++ {
		ts[i] = models.Task{
			ID:        fmt.Sprintf("T%d", i),
			Status:    models.TaskTodo,
			DependsOn: []string{fmt.Sprintf("T%d", i-1)},
		}
	}
	// Mark all but the last as done so only T999 is ready
	for i := 1; i < n-1; i++ {
		ts[i].Status = models.TaskDone
	}
	start := time.Now()
	ready := scheduler.ReadyIDs(ts)
	if elapsed := time.Since(start); elapsed > 50*time.Millisecond {
		t.Errorf("ReadyIDs on %d-node DAG took %v, want <50ms", n, elapsed)
	}
	if len(ready) != 1 || ready[0] != fmt.Sprintf("T%d", n-1) {
		t.Errorf("expected [T999] ready, got %v", ready)
	}
}
