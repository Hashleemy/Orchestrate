package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"local-agent-orchestrator/internal/sessions"
)

// ReviewRequest is persisted when a review is initiated and read by the reviewer agent.
type ReviewRequest struct {
	ReviewerID  string `json:"reviewer_id"`
	WorkerID    string `json:"worker_id"`
	TaskID      string `json:"task_id"`
	Branch      string `json:"branch"`
	BaseRef     string `json:"base_ref"`
	RequestedAt string `json:"requested_at"`
	Status      string `json:"status"` // "pending" | "complete"
}

// ReviewVerdict is written by the reviewer agent after it finishes its analysis.
type ReviewVerdict struct {
	ReviewerID          string   `json:"reviewer_id"`
	WorkerID            string   `json:"worker_id"`
	TaskID              string   `json:"task_id"`
	Branch              string   `json:"branch"`
	Verdict             string   `json:"verdict"`              // "approve" | "revise"
	Issues              []string `json:"issues"`
	Risk                string   `json:"risk"`                 // "low" | "medium" | "high"
	MergeRecommendation string   `json:"merge_recommendation"` // "ready" | "needs-changes" | "escalate-to-user"
	ReviewedAt          string   `json:"reviewed_at"`
}

// SpawnReviewer launches a reviewer agent to inspect a worker's branch.
// It creates a ReviewRequest file in agent-comms/reviews/ so the reviewer agent
// can read its assignment, then starts the agent session.
func (o *Orchestrator) SpawnReviewer(workerID, taskID string) (*sessions.LaunchedSession, error) {
	state, err := o.agentState(workerID)
	if err != nil {
		return nil, fmt.Errorf("worker state not found: %w", err)
	}
	branch := state.Branch
	if branch == "" {
		branch = "agent/" + strings.TrimPrefix(workerID, "agent-")
	}

	reviewerID := "agent-reviewer-" + strings.TrimPrefix(workerID, "agent-")

	reviewsDir := filepath.Join(o.cfg.CommsDir, "reviews")
	if err := os.MkdirAll(reviewsDir, 0755); err != nil {
		return nil, fmt.Errorf("create reviews dir: %w", err)
	}

	req := &ReviewRequest{
		ReviewerID:  reviewerID,
		WorkerID:    workerID,
		TaskID:      taskID,
		Branch:      branch,
		BaseRef:     "main",
		RequestedAt: time.Now().UTC().Format(time.RFC3339),
		Status:      "pending",
	}
	data, _ := json.MarshalIndent(req, "", "  ")
	if err := os.WriteFile(filepath.Join(reviewsDir, reviewerID+"-request.json"), data, 0644); err != nil {
		return nil, fmt.Errorf("write review request: %w", err)
	}

	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")
	sess, err := sessions.Launch(sessions.LaunchConfig{
		AgentID:            reviewerID,
		Role:               "reviewer",
		TaskID:             taskID,
		TaskFile:           tasksFile,
		RepoRoot:           o.cfg.RepoRoot,
		BaseRef:            "main",
		UseWindowsTerminal: o.cfg.UseWindowsTerminal,
	}, o.sessions)
	if err != nil {
		return nil, fmt.Errorf("launch reviewer: %w", err)
	}
	return sess, nil
}

// ReviewVerdicts returns all completed review verdicts, newest first.
func (o *Orchestrator) ReviewVerdicts() ([]*ReviewVerdict, error) {
	dir := filepath.Join(o.cfg.CommsDir, "reviews")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []*ReviewVerdict
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" || strings.HasSuffix(e.Name(), "-request.json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var v ReviewVerdict
		if err := json.Unmarshal(data, &v); err != nil {
			continue
		}
		out = append(out, &v)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ReviewedAt > out[j].ReviewedAt
	})
	return out, nil
}

// ReviewRequests returns all pending review requests.
func (o *Orchestrator) ReviewRequests() ([]*ReviewRequest, error) {
	dir := filepath.Join(o.cfg.CommsDir, "reviews")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []*ReviewRequest
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), "-request.json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var req ReviewRequest
		if err := json.Unmarshal(data, &req); err != nil {
			continue
		}
		out = append(out, &req)
	}
	return out, nil
}

func (o *Orchestrator) agentState(agentID string) (*sessions.AgentState, error) {
	statusPath := filepath.Join(o.cfg.CommsDir, "status", agentID+".json")
	data, err := os.ReadFile(statusPath)
	if err == nil {
		var state sessions.AgentState
		if jsonErr := json.Unmarshal(data, &state); jsonErr == nil {
			return &state, nil
		}
	}
	if state, ok := o.sessions.Get(agentID); ok {
		return state, nil
	}
	return nil, fmt.Errorf("no state for agent %s", agentID)
}
