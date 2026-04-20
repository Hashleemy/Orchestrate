package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"local-agent-orchestrator/internal/gitops"
	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/parser"
	"local-agent-orchestrator/internal/tasks"
)

// AssignTask sets the owner and status of a task in the live tasks.md file
// and writes a claim file so agents can detect the assignment.
// It is blocked if any checkpoint is still pending.
func (o *Orchestrator) AssignTask(taskID, agentID, branch, worktree string) error {
	if err := o.GuardPendingCheckpoints("assign_task"); err != nil {
		return err
	}
	tasks, err := o.Tasks()
	if err != nil {
		return err
	}

	found := false
	for i := range tasks {
		if tasks[i].ID == taskID {
			if tasks[i].Status != models.TaskReady {
				return fmt.Errorf("task %s is not ready (status: %s)", taskID, tasks[i].Status)
			}
			tasks[i].Owner = agentID
			tasks[i].Branch = branch
			tasks[i].Worktree = worktree
			tasks[i].Status = models.TaskInProgress
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("task not found: %s", taskID)
	}

	if err := o.writeTasks(tasks); err != nil {
		return err
	}

	return o.writeClaim(taskID, agentID)
}

// UnassignTask clears the owner of a task and reverts it to ready so another
// agent can pick it up.
func (o *Orchestrator) UnassignTask(taskID string) error {
	tasks, err := o.Tasks()
	if err != nil {
		return err
	}

	for i := range tasks {
		if tasks[i].ID == taskID {
			tasks[i].Owner = "unassigned"
			tasks[i].Branch = "none"
			tasks[i].Worktree = "none"
			tasks[i].Status = models.TaskReady
			return o.writeTasks(tasks)
		}
	}
	return fmt.Errorf("task not found: %s", taskID)
}

// CompleteTask marks a task done and removes its claim file.
func (o *Orchestrator) CompleteTask(taskID string) error {
	tasks, err := o.Tasks()
	if err != nil {
		return err
	}

	for i := range tasks {
		if tasks[i].ID == taskID {
			tasks[i].Status = models.TaskDone
			if err := o.writeTasks(tasks); err != nil {
				return err
			}
			_ = os.Remove(filepath.Join(o.cfg.CommsDir, "claims", "TASK-"+taskID+".json"))
			return nil
		}
	}
	return fmt.Errorf("task not found: %s", taskID)
}

// InitiateMerge performs a dry-run check and, if no conflicts are detected,
// merges the agent's branch into the integration branch. A checkpoint is
// raised instead if conflicts are found or the diff is classified as major.
func (o *Orchestrator) InitiateMerge(agentID, fromBranch, intoBranch string) (*MergeResult, error) {
	conflicts, err := gitops.DryRunMerge(o.cfg.RepoRoot, fromBranch, intoBranch)
	if err != nil {
		return nil, fmt.Errorf("dry-run merge: %w", err)
	}
	if conflicts {
		cp, _ := o.RaiseCheckpoint(
			string(CheckpointMergeConflict),
			fmt.Sprintf("merge %s → %s has conflicts; manual resolution required", fromBranch, intoBranch),
			[]string{"Resolve conflicts manually then retry merge", "Abort merge and reassign task"},
		)
		return &MergeResult{AgentID: agentID, FromBranch: fromBranch, IntoBranch: intoBranch, CheckpointID: cp.ID}, nil
	}

	if err := gitops.Checkout(o.cfg.RepoRoot, intoBranch); err != nil {
		return nil, err
	}
	gr, err := gitops.MergeBranch(o.cfg.RepoRoot, fromBranch, intoBranch)
	if err != nil {
		_ = gitops.AbortMerge(o.cfg.RepoRoot)
		return nil, fmt.Errorf("merge failed: %w", err)
	}

	return &MergeResult{
		AgentID:    agentID,
		FromBranch: gr.FromBranch,
		IntoBranch: gr.IntoBranch,
		Output:     gr.Output,
	}, nil
}

// MergeResult is returned by InitiateMerge.
type MergeResult struct {
	AgentID      string `json:"agent_id"`
	FromBranch   string `json:"from_branch"`
	IntoBranch   string `json:"into_branch"`
	Output       string `json:"output,omitempty"`
	CheckpointID string `json:"checkpoint_id,omitempty"`
}

// writeClaim writes an agent-comms/claims/TASK-<id>.json file.
func (o *Orchestrator) writeClaim(taskID, agentID string) error {
	claimsDir := filepath.Join(o.cfg.CommsDir, "claims")
	if err := os.MkdirAll(claimsDir, 0755); err != nil {
		return err
	}
	claim := map[string]string{
		"task_id":    taskID,
		"agent":      agentID,
		"claimed_at": time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(claim, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(claimsDir, "TASK-"+taskID+".json"), data, 0644)
}

// writeTasks serializes the updated task list back to the live tasks.md file,
// preserving any global rules from the existing file.
func (o *Orchestrator) writeTasks(updated []models.Task) error {
	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")

	// Preserve global rules from the existing file if present.
	var rules []string
	if data, err := os.ReadFile(tasksFile); err == nil {
		if list, err := parser.Parse(string(data)); err == nil {
			rules = list.GlobalRules
		}
	}

	content := tasks.SerializeTasks(rules, updated)
	return os.WriteFile(tasksFile, []byte(content), 0644)
}
