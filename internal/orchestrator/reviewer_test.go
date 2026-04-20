package orchestrator_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"local-agent-orchestrator/internal/orchestrator"
)

func writeVerdict(t *testing.T, commsDir string, v *orchestrator.ReviewVerdict) {
	t.Helper()
	dir := filepath.Join(commsDir, "reviews")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	data, _ := json.MarshalIndent(v, "", "  ")
	if err := os.WriteFile(filepath.Join(dir, v.ReviewerID+".json"), data, 0644); err != nil {
		t.Fatal(err)
	}
}

func writeRequest(t *testing.T, commsDir string, req *orchestrator.ReviewRequest) {
	t.Helper()
	dir := filepath.Join(commsDir, "reviews")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	data, _ := json.MarshalIndent(req, "", "  ")
	name := req.ReviewerID + "-request.json"
	if err := os.WriteFile(filepath.Join(dir, name), data, 0644); err != nil {
		t.Fatal(err)
	}
}

func TestReviewVerdicts_Empty(t *testing.T) {
	orch, _ := newTestOrch(t)
	verdicts, err := orch.ReviewVerdicts()
	if err != nil {
		t.Fatalf("ReviewVerdicts: %v", err)
	}
	if len(verdicts) != 0 {
		t.Errorf("expected 0 verdicts, got %d", len(verdicts))
	}
}

func TestReviewVerdicts_ReadsFromDisk(t *testing.T) {
	orch, commsDir := newTestOrch(t)

	writeVerdict(t, commsDir, &orchestrator.ReviewVerdict{
		ReviewerID:          "agent-reviewer-worker-01",
		WorkerID:            "agent-worker-01",
		TaskID:              "TASK-001",
		Branch:              "agent/worker-01",
		Verdict:             "approve",
		Issues:              []string{},
		Risk:                "low",
		MergeRecommendation: "ready",
		ReviewedAt:          "2024-01-01T12:00:00Z",
	})

	verdicts, err := orch.ReviewVerdicts()
	if err != nil {
		t.Fatalf("ReviewVerdicts: %v", err)
	}
	if len(verdicts) != 1 {
		t.Fatalf("expected 1 verdict, got %d", len(verdicts))
	}
	if verdicts[0].Verdict != "approve" {
		t.Errorf("expected approve, got %s", verdicts[0].Verdict)
	}
}

func TestReviewVerdicts_SkipsRequestFiles(t *testing.T) {
	orch, commsDir := newTestOrch(t)

	writeRequest(t, commsDir, &orchestrator.ReviewRequest{
		ReviewerID:  "agent-reviewer-worker-01",
		WorkerID:    "agent-worker-01",
		TaskID:      "TASK-001",
		Branch:      "agent/worker-01",
		BaseRef:     "main",
		RequestedAt: "2024-01-01T12:00:00Z",
		Status:      "pending",
	})

	verdicts, err := orch.ReviewVerdicts()
	if err != nil {
		t.Fatalf("ReviewVerdicts: %v", err)
	}
	if len(verdicts) != 0 {
		t.Errorf("expected 0 verdicts (requests should be skipped), got %d", len(verdicts))
	}
}

func TestReviewRequests_ReadsFromDisk(t *testing.T) {
	orch, commsDir := newTestOrch(t)

	writeRequest(t, commsDir, &orchestrator.ReviewRequest{
		ReviewerID:  "agent-reviewer-worker-02",
		WorkerID:    "agent-worker-02",
		TaskID:      "TASK-002",
		Branch:      "agent/worker-02",
		BaseRef:     "main",
		RequestedAt: "2024-01-01T13:00:00Z",
		Status:      "pending",
	})

	reqs, err := orch.ReviewRequests()
	if err != nil {
		t.Fatalf("ReviewRequests: %v", err)
	}
	if len(reqs) != 1 {
		t.Fatalf("expected 1 request, got %d", len(reqs))
	}
	if reqs[0].TaskID != "TASK-002" {
		t.Errorf("expected TASK-002, got %s", reqs[0].TaskID)
	}
}
