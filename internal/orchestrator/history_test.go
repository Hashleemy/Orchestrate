package orchestrator_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/orchestrator"
)

func newRunRecord(id string) *orchestrator.RunRecord {
	now := time.Now()
	return &orchestrator.RunRecord{
		ID:          id,
		StartedAt:   now.Add(-30 * time.Second),
		EndedAt:     now,
		DurationSec: 30,
		Status:      models.RunStopped,
		RepoPath:    "/tmp/repo",
		Workers:     []string{"agent-coordinator-01", "agent-worker-01"},
		TasksDone:   2,
		TasksTotal:  3,
		DoneIDs:     []string{"TASK-001", "TASK-002"},
		EventCount:  12,
		Summary:     "Two tasks completed.",
	}
}

func TestRunHistory_RecordAndList(t *testing.T) {
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	if err := os.MkdirAll(commsDir, 0755); err != nil {
		t.Fatal(err)
	}

	h := orchestrator.NewRunHistory(commsDir)

	rec := newRunRecord("run-1000")
	if err := h.Record(rec); err != nil {
		t.Fatalf("Record: %v", err)
	}

	list, err := h.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 record, got %d", len(list))
	}
	if list[0].ID != "run-1000" {
		t.Errorf("expected run-1000, got %s", list[0].ID)
	}
	if list[0].TasksDone != 2 {
		t.Errorf("expected 2 tasks done, got %d", list[0].TasksDone)
	}
}

func TestRunHistory_Get(t *testing.T) {
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	os.MkdirAll(commsDir, 0755)

	h := orchestrator.NewRunHistory(commsDir)
	h.Record(newRunRecord("run-2000"))

	rec, err := h.Get("run-2000")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if rec.Workers[0] != "agent-coordinator-01" {
		t.Errorf("unexpected worker: %s", rec.Workers[0])
	}
}

func TestRunHistory_GetMissing(t *testing.T) {
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	os.MkdirAll(commsDir, 0755)

	h := orchestrator.NewRunHistory(commsDir)
	_, err := h.Get("run-nonexistent")
	if err == nil {
		t.Error("expected error for missing run, got nil")
	}
}

func TestRunHistory_ListEmpty(t *testing.T) {
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	os.MkdirAll(commsDir, 0755)

	h := orchestrator.NewRunHistory(commsDir)
	list, err := h.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0 records, got %d", len(list))
	}
}

func TestRunHistory_ListNewestFirst(t *testing.T) {
	tmp := t.TempDir()
	commsDir := filepath.Join(tmp, "agent-comms")
	os.MkdirAll(commsDir, 0755)

	h := orchestrator.NewRunHistory(commsDir)

	older := newRunRecord("run-older")
	older.StartedAt = time.Now().Add(-2 * time.Hour)
	newer := newRunRecord("run-newer")
	newer.StartedAt = time.Now().Add(-1 * time.Hour)

	h.Record(older)
	h.Record(newer)

	list, err := h.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2, got %d", len(list))
	}
	if list[0].ID != "run-newer" {
		t.Errorf("expected newest first, got %s", list[0].ID)
	}
}
