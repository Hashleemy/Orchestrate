package orchestrator_test

import (
	"os"
	"path/filepath"
	"testing"

	"local-agent-orchestrator/internal/approvals"
	"local-agent-orchestrator/internal/orchestrator"
	"local-agent-orchestrator/internal/sessions"
)

func newTestOrch(t *testing.T) (*orchestrator.Orchestrator, string) {
	t.Helper()
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	for _, sub := range []string{"messages", "status", "claims", "events", "approvals", "tasks", "checkpoints"} {
		if err := os.MkdirAll(filepath.Join(commsDir, sub), 0755); err != nil {
			t.Fatal(err)
		}
	}
	store := sessions.NewStore()
	svc := approvals.NewService()
	orch := orchestrator.New(orchestrator.Config{
		CommsDir: commsDir,
		RepoRoot: tmp,
	}, store, svc)
	return orch, commsDir
}

func TestCheckpoint_RaiseAndList(t *testing.T) {
	orch, _ := newTestOrch(t)

	cp, err := orch.RaiseCheckpoint("major_change", "large diff detected", []string{"review and approve", "abort"})
	if err != nil {
		t.Fatalf("RaiseCheckpoint: %v", err)
	}
	if cp.ID == "" {
		t.Error("expected checkpoint to have an ID")
	}
	if cp.Status != "pending" {
		t.Errorf("expected pending, got %s", cp.Status)
	}

	active, err := orch.ActiveCheckpoints()
	if err != nil {
		t.Fatalf("ActiveCheckpoints: %v", err)
	}
	if len(active) != 1 {
		t.Errorf("expected 1 active checkpoint, got %d", len(active))
	}
}

func TestCheckpoint_Resolve(t *testing.T) {
	orch, _ := newTestOrch(t)

	cp, _ := orch.RaiseCheckpoint("milestone", "phase 1 complete", []string{"continue", "stop"})

	if err := orch.ResolveCheckpoint(cp.ID, "continue"); err != nil {
		t.Fatalf("ResolveCheckpoint: %v", err)
	}

	active, _ := orch.ActiveCheckpoints()
	if len(active) != 0 {
		t.Errorf("expected 0 active checkpoints after resolve, got %d", len(active))
	}
}

func TestCheckpoint_GuardBlocks(t *testing.T) {
	orch, _ := newTestOrch(t)

	orch.RaiseCheckpoint("major_change", "blocked", []string{"review"})

	err := orch.GuardPendingCheckpoints("test_op")
	if err == nil {
		t.Error("expected GuardPendingCheckpoints to return error when checkpoint is pending")
	}
}

func TestCheckpoint_GuardPassesWhenClear(t *testing.T) {
	orch, _ := newTestOrch(t)

	err := orch.GuardPendingCheckpoints("test_op")
	if err != nil {
		t.Errorf("expected no error when no checkpoints pending, got: %v", err)
	}
}

func TestSummary_EmptyRun(t *testing.T) {
	orch, commsDir := newTestOrch(t)

	// Write an empty tasks.md
	tasksFile := filepath.Join(commsDir, "tasks", "tasks.md")
	if err := os.WriteFile(tasksFile, []byte("# Tasks\n"), 0644); err != nil {
		t.Fatal(err)
	}

	summary, err := orch.BuildSummary()
	if err != nil {
		t.Fatalf("BuildSummary: %v", err)
	}
	if summary == nil {
		t.Fatal("expected non-nil summary")
	}
	if len(summary.NextSteps) == 0 {
		t.Error("expected at least one next step in empty summary")
	}
}

func TestSummary_Format(t *testing.T) {
	orch, commsDir := newTestOrch(t)

	tasksFile := filepath.Join(commsDir, "tasks", "tasks.md")
	os.WriteFile(tasksFile, []byte("# Tasks\n"), 0644)

	summary, _ := orch.BuildSummary()
	text := orchestrator.FormatSummary(summary)
	if text == "" {
		t.Error("expected non-empty formatted summary")
	}
	if len(text) < 20 {
		t.Errorf("summary seems too short: %q", text)
	}
}

func TestStartRun_BlockedByCheckpoint(t *testing.T) {
	orch, _ := newTestOrch(t)

	orch.RaiseCheckpoint("major_change", "blocked", []string{"review"})

	err := orch.StartRun("# Tasks\n")
	if err == nil {
		t.Error("expected StartRun to fail when checkpoint is pending")
	}
}
