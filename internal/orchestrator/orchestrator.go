package orchestrator

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"local-agent-orchestrator/internal/approvals"
	"local-agent-orchestrator/internal/gitops"
	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/parser"
	"local-agent-orchestrator/internal/policy"
	"local-agent-orchestrator/internal/scheduler"
	"local-agent-orchestrator/internal/sessions"
)

type Config struct {
	CommsDir           string
	RepoRoot           string
	// UseWindowsTerminal enables launching agents as named Windows Terminal tabs.
	// When false (default), the PowerShell script auto-detects wt.exe availability.
	UseWindowsTerminal bool
}

type Event struct {
	Timestamp string `json:"timestamp"`
	Agent     string `json:"agent"`
	TaskID    string `json:"task_id"`
	Type      string `json:"type"`
	Detail    string `json:"detail"`
}

type Claim struct {
	TaskID    string `json:"task_id"`
	Agent     string `json:"agent"`
	ClaimedAt string `json:"claimed_at"`
}

const staleThreshold = 5 * time.Minute

// commsDirs are the subdirectories that must exist under CommsDir.
var commsDirs = []string{"messages", "status", "claims", "events", "approvals", "tasks"}

type Orchestrator struct {
	cfg       Config
	sessions  *sessions.Store
	approvals *approvals.Service
	sched     *scheduler.Scheduler
	history   *RunHistory

	runMu        sync.Mutex
	activeRunID  string
	runStartedAt time.Time
	runWorkers   []string
}

func New(cfg Config, ss *sessions.Store, svc *approvals.Service) *Orchestrator {
	if err := ensureCommsDirs(cfg.CommsDir); err != nil {
		log.Printf("orchestrator: init comms dirs: %v", err)
	}

	tasksFile := filepath.Join(cfg.CommsDir, "tasks", "tasks.md")
	eventsDir := filepath.Join(cfg.CommsDir, "events")
	sched := scheduler.New(tasksFile, eventsDir, 10*time.Second)
	sched.Start()

	return &Orchestrator{cfg: cfg, sessions: ss, approvals: svc, sched: sched, history: newRunHistory(cfg.CommsDir)}
}

func ensureCommsDirs(commsDir string) error {
	for _, sub := range commsDirs {
		if err := os.MkdirAll(filepath.Join(commsDir, sub), 0755); err != nil {
			return err
		}
	}
	return nil
}

func (o *Orchestrator) AgentStatuses() ([]*sessions.AgentState, error) {
	statusDir := filepath.Join(o.cfg.CommsDir, "status")
	entries, err := os.ReadDir(statusDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []*sessions.AgentState
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(statusDir, e.Name()))
		if err != nil {
			continue
		}
		var s sessions.AgentState
		if err := json.Unmarshal(data, &s); err != nil {
			continue
		}
		if s.State != "complete" && s.State != "idle" && !s.Timestamp.IsZero() {
			s.Stale = time.Since(s.Timestamp) > staleThreshold
		}
		out = append(out, &s)
	}
	return out, nil
}

func (o *Orchestrator) Events() ([]Event, error) {
	eventsDir := filepath.Join(o.cfg.CommsDir, "events")
	entries, err := os.ReadDir(eventsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []Event
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".jsonl" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(eventsDir, e.Name()))
		if err != nil {
			continue
		}
		events, err := parseJSONL[Event](data)
		if err != nil {
			continue
		}
		out = append(out, events...)
	}
	return out, nil
}

func (o *Orchestrator) Messages() ([]map[string]any, error) {
	messagesDir := filepath.Join(o.cfg.CommsDir, "messages")
	entries, err := os.ReadDir(messagesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []map[string]any
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(messagesDir, e.Name()))
		if err != nil {
			continue
		}
		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		out = append(out, msg)
	}
	return out, nil
}

func (o *Orchestrator) Claims() ([]Claim, error) {
	claimsDir := filepath.Join(o.cfg.CommsDir, "claims")
	entries, err := os.ReadDir(claimsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []Claim
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(claimsDir, e.Name()))
		if err != nil {
			continue
		}
		var c Claim
		if err := json.Unmarshal(data, &c); err != nil {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func (o *Orchestrator) FileApprovals() ([]*FileApproval, error) {
	dir := filepath.Join(o.cfg.CommsDir, "approvals")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []*FileApproval
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var a FileApproval
		if err := json.Unmarshal(data, &a); err != nil {
			continue
		}
		out = append(out, &a)
	}
	return out, nil
}

func (o *Orchestrator) ResolveFileApproval(id, status string) error {
	dir := filepath.Join(o.cfg.CommsDir, "approvals")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var a FileApproval
		if err := json.Unmarshal(data, &a); err != nil {
			continue
		}
		if a.ID != id {
			continue
		}
		now := time.Now().UTC().Format(time.RFC3339)
		a.Status = status
		a.ResolvedAt = &now
		updated, err := json.MarshalIndent(a, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(path, updated, 0644)
	}
	return fmt.Errorf("approval not found: %s", id)
}

type FileApproval struct {
	ID         string  `json:"id"`
	Trigger    string  `json:"trigger"`
	Agent      string  `json:"agent"`
	TaskID     string  `json:"task_id"`
	Detail     string  `json:"detail"`
	Status     string  `json:"status"`
	CreatedAt  string  `json:"created_at"`
	ResolvedAt *string `json:"resolved_at"`
}

func (o *Orchestrator) Tasks() ([]models.Task, error) {
	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")
	data, err := os.ReadFile(tasksFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	list, err := parser.Parse(string(data))
	if err != nil {
		return nil, err
	}
	return list.Tasks, nil
}

// StartRun writes tasks.md to agent-comms/tasks/ and spawns the coordinator agent.
// It is blocked if any checkpoint is still pending.
func (o *Orchestrator) StartRun(tasksContent string) error {
	if err := o.GuardPendingCheckpoints("start_run"); err != nil {
		return err
	}

	tasksDir := filepath.Join(o.cfg.CommsDir, "tasks")
	if err := os.MkdirAll(tasksDir, 0755); err != nil {
		return fmt.Errorf("create tasks dir: %w", err)
	}

	tasksFile := filepath.Join(tasksDir, "tasks.md")
	if err := os.WriteFile(tasksFile, []byte(tasksContent), 0644); err != nil {
		return fmt.Errorf("write tasks.md: %w", err)
	}

	// Validate it parses before spawning anything
	if _, err := parser.Parse(tasksContent); err != nil {
		return fmt.Errorf("invalid tasks.md: %w", err)
	}

	o.runMu.Lock()
	o.activeRunID = fmt.Sprintf("run-%d", time.Now().UnixMilli())
	o.runStartedAt = time.Now()
	o.runWorkers = []string{"agent-coordinator-01"}
	o.runMu.Unlock()

	return o.spawnCoordinator(tasksFile)
}

func (o *Orchestrator) spawnCoordinator(tasksFile string) error {
	args := []string{
		"-NoProfile", "-File", filepath.Join(o.cfg.RepoRoot, "scripts", "launch-agent.ps1"),
		"-AgentId", "agent-coordinator-01",
		"-Role", "coordinator",
		"-TaskId", "coordinator",
		"-TaskFile", tasksFile,
		"-RepoRoot", o.cfg.RepoRoot,
		"-BaseRef", "main",
	}
	if o.cfg.UseWindowsTerminal {
		args = append(args, "-PreferWindowsTerminal")
	}
	cmd := exec.Command("powershell", args...)
	cmd.Dir = o.cfg.RepoRoot
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("spawn coordinator: %w", err)
	}
	return nil
}

// StopRun stops the scheduler and cleans up all agent worktrees, returning
// a summary of what was removed and any errors encountered.
// SpawnResult holds the outcome of a multi-agent parallel launch.
type SpawnResult struct {
	Coordinator *sessions.LaunchedSession  `json:"coordinator"`
	Workers     []*sessions.LaunchedSession `json:"workers"`
	Errors      []string                   `json:"errors"`
}

// SpawnWorkers writes tasks.md, spawns the coordinator, and launches workerCount
// worker agents in parallel, assigning each to a distinct ready task.
// Worker count is clamped to [1, 5].
func (o *Orchestrator) SpawnWorkers(tasksContent string, workerCount int) (*SpawnResult, error) {
	if err := o.GuardPendingCheckpoints("spawn_workers"); err != nil {
		return nil, err
	}
	if workerCount < 1 {
		workerCount = 1
	}
	if workerCount > 5 {
		workerCount = 5
	}

	tasksDir := filepath.Join(o.cfg.CommsDir, "tasks")
	if err := os.MkdirAll(tasksDir, 0755); err != nil {
		return nil, fmt.Errorf("create tasks dir: %w", err)
	}
	tasksFile := filepath.Join(tasksDir, "tasks.md")
	if err := os.WriteFile(tasksFile, []byte(tasksContent), 0644); err != nil {
		return nil, fmt.Errorf("write tasks.md: %w", err)
	}

	list, err := parser.Parse(tasksContent)
	if err != nil {
		return nil, fmt.Errorf("invalid tasks.md: %w", err)
	}
	readyIDs := scheduler.ReadyIDs(list.Tasks)

	coord, err := sessions.Launch(sessions.LaunchConfig{
		AgentID:            "agent-coordinator-01",
		Role:               "coordinator",
		TaskID:             "coordinator",
		TaskFile:           tasksFile,
		RepoRoot:           o.cfg.RepoRoot,
		BaseRef:            "main",
		UseWindowsTerminal: o.cfg.UseWindowsTerminal,
	}, o.sessions)
	if err != nil {
		return nil, fmt.Errorf("spawn coordinator: %w", err)
	}

	workerCfgs := make([]sessions.LaunchConfig, workerCount)
	for i := range workerCfgs {
		taskID := ""
		if i < len(readyIDs) {
			taskID = readyIDs[i]
		}
		workerCfgs[i] = sessions.LaunchConfig{
			AgentID:            fmt.Sprintf("agent-worker-%02d", i+1),
			Role:               "worker",
			TaskID:             taskID,
			TaskFile:           tasksFile,
			RepoRoot:           o.cfg.RepoRoot,
			BaseRef:            "main",
			UseWindowsTerminal: o.cfg.UseWindowsTerminal,
		}
	}

	workers, errs := sessions.LaunchMany(workerCfgs, o.sessions)
	errStrs := make([]string, len(errs))
	for i, e := range errs {
		errStrs[i] = e.Error()
	}

	allWorkerIDs := make([]string, 0, 1+len(workers))
	allWorkerIDs = append(allWorkerIDs, coord.AgentID)
	for _, w := range workers {
		allWorkerIDs = append(allWorkerIDs, w.AgentID)
	}
	o.runMu.Lock()
	o.activeRunID = fmt.Sprintf("run-%d", time.Now().UnixMilli())
	o.runStartedAt = time.Now()
	o.runWorkers = allWorkerIDs
	o.runMu.Unlock()

	return &SpawnResult{
		Coordinator: coord,
		Workers:     workers,
		Errors:      errStrs,
	}, nil
}

// StopRun stops the scheduler, persists a run history record, and cleans up
// all agent worktrees. Returns a summary of what was removed and any errors.
func (o *Orchestrator) StopRun() map[string]any {
	o.sched.Stop()

	o.runMu.Lock()
	runID := o.activeRunID
	startedAt := o.runStartedAt
	workers := o.runWorkers
	o.activeRunID = ""
	o.runWorkers = nil
	o.runMu.Unlock()

	if runID != "" {
		o.persistRunRecord(runID, startedAt, workers, models.RunStopped)
	}

	paths, err := gitops.AgentWorktreePaths(o.cfg.RepoRoot)
	result := map[string]any{
		"worktrees_removed": []string{},
		"errors":            []string{},
	}
	if err != nil {
		result["errors"] = []string{err.Error()}
		return result
	}

	errs := gitops.CleanupWorktrees(o.cfg.RepoRoot, paths)
	errStrs := make([]string, len(errs))
	for i, e := range errs {
		errStrs[i] = e.Error()
	}
	result["worktrees_removed"] = paths
	result["errors"] = errStrs
	return result
}

func (o *Orchestrator) persistRunRecord(id string, startedAt time.Time, workers []string, status models.RunStatus) {
	tasks, _ := o.Tasks()
	done := 0
	var doneIDs []string
	for _, t := range tasks {
		if t.Status == models.TaskDone {
			done++
			doneIDs = append(doneIDs, t.ID)
		}
	}
	events, _ := o.Events()
	var summaryText string
	if s, err := o.BuildSummary(); err == nil && s != nil {
		summaryText = FormatSummary(s)
	}
	now := time.Now()
	rec := &RunRecord{
		ID:          id,
		StartedAt:   startedAt,
		EndedAt:     now,
		DurationSec: now.Sub(startedAt).Seconds(),
		Status:      status,
		RepoPath:    o.cfg.RepoRoot,
		Workers:     workers,
		TasksDone:   done,
		TasksTotal:  len(tasks),
		DoneIDs:     doneIDs,
		EventCount:  len(events),
		Summary:     summaryText,
	}
	if err := o.history.record(rec); err != nil {
		log.Printf("orchestrator: persist run record: %v", err)
	}
}

// RunRecords returns all persisted run records, newest first.
func (o *Orchestrator) RunRecords() ([]*RunRecord, error) {
	return o.history.List()
}

// RunRecord returns a single persisted run record by ID.
func (o *Orchestrator) RunRecord(id string) (*RunRecord, error) {
	return o.history.Get(id)
}

// DiffSummary is returned by the /api/agents/{id}/diff endpoint.
type DiffSummary struct {
	AgentID    string                    `json:"agent_id"`
	Branch     string                    `json:"branch"`
	BaseRef    string                    `json:"base_ref"`
	Kind       policy.DiffKind           `json:"kind"`
	Triggers   []policy.CheckpointTrigger `json:"triggers"`
	Reasons    []string                  `json:"reasons"`
	Files      []string                  `json:"files"`
	FileCount  int                       `json:"file_count"`
	Insertions int                       `json:"insertions"`
	Deletions  int                       `json:"deletions"`
}

// ClassifyAgentDiff runs a git diff for the given agent's branch against the
// repo's base ref and returns a policy classification.
func (o *Orchestrator) ClassifyAgentDiff(agentID string) (*DiffSummary, error) {
	statusPath := filepath.Join(o.cfg.CommsDir, "status", agentID+".json")
	data, err := os.ReadFile(statusPath)
	if err != nil {
		return nil, fmt.Errorf("agent status not found: %w", err)
	}
	var state sessions.AgentState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("parse agent status: %w", err)
	}
	if state.Branch == "" {
		return nil, fmt.Errorf("agent %s has no branch recorded", agentID)
	}

	baseRef := gitops.BaseRef(o.cfg.RepoRoot)

	stat, err := gitops.Stat(o.cfg.RepoRoot, baseRef, state.Branch)
	if err != nil {
		return nil, fmt.Errorf("git diff: %w", err)
	}

	files := make([]string, len(stat.Files))
	for i, f := range stat.Files {
		files[i] = f.Path
	}

	// Look up the task to include task-level risk signals.
	var task *models.Task
	if state.TaskID != "" {
		if tasks, err := o.Tasks(); err == nil {
			for i := range tasks {
				if tasks[i].ID == state.TaskID {
					task = &tasks[i]
					break
				}
			}
		}
	}

	class := policy.ClassifyFiles(files, task)

	// Auto-raise a checkpoint for blocked or major diffs so the user is
	// prompted before any merge can proceed.
	if class.Kind == policy.DiffBlocked || class.Kind == policy.DiffMajor {
		triggers := make([]string, len(class.Triggers))
		for i, t := range class.Triggers {
			triggers[i] = string(t)
		}
		detail := fmt.Sprintf("agent %s branch %s classified as %s: %s",
			agentID, state.Branch, class.Kind, strings.Join(class.Reasons, "; "))
		_, _ = o.RaiseFromTriggers(triggers, detail)
	}

	return &DiffSummary{
		AgentID:    agentID,
		Branch:     state.Branch,
		BaseRef:    baseRef,
		Kind:       class.Kind,
		Triggers:   class.Triggers,
		Reasons:    class.Reasons,
		Files:      files,
		FileCount:  stat.FileCount,
		Insertions: stat.Insertions,
		Deletions:  stat.Deletions,
	}, nil
}

func parseJSONL[T any](data []byte) ([]T, error) {
	var out []T
	start := 0
	for i := 0; i <= len(data); i++ {
		if i == len(data) || data[i] == '\n' {
			line := data[start:i]
			start = i + 1
			if len(line) == 0 {
				continue
			}
			var item T
			if err := json.Unmarshal(line, &item); err != nil {
				continue
			}
			out = append(out, item)
		}
	}
	return out, nil
}
