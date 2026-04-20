package orchestrator

import (
	"fmt"

	"local-agent-orchestrator/internal/gitops"
	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/policy"
	"local-agent-orchestrator/internal/sessions"
)

// AgentPushResult is returned by PushBranch and PushBranchForce.
type AgentPushResult struct {
	AgentID      string              `json:"agent_id"`
	Branch       string              `json:"branch"`
	Status       string              `json:"status"` // "pushed" | "approval_required" | "blocked"
	Decision     *policy.PushDecision `json:"decision"`
	CheckpointID string              `json:"checkpoint_id,omitempty"`
	Output       string              `json:"output,omitempty"`
}

// PushBranch evaluates the push policy for an agent's current branch and either:
//   - Pushes immediately when the diff is minor.
//   - Raises a checkpoint and returns when the diff is major (approval needed).
//   - Raises a checkpoint and returns an error when blocked (sensitive files).
//
// It never generates a force-push.
func (o *Orchestrator) PushBranch(agentID string) (*AgentPushResult, error) {
	state, err := o.agentState(agentID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}
	branch := state.Branch
	if branch == "" {
		return nil, fmt.Errorf("agent %s has no branch recorded", agentID)
	}

	files, task, err := o.agentDiffFiles(agentID, state)
	_ = agentID
	if err != nil {
		return nil, err
	}

	decision := policy.EvaluatePush(branch, files, task)
	result := &AgentPushResult{AgentID: agentID, Branch: branch, Decision: decision}

	switch {
	case decision.Blocked:
		cp, _ := o.RaiseCheckpoint(
			string(CheckpointSensitiveFile),
			fmt.Sprintf("push blocked for %s on %s: %v", agentID, branch, decision.Reasons),
			[]string{"Resolve policy issues then retry push", "Abort push"},
		)
		if cp != nil {
			result.CheckpointID = cp.ID
		}
		result.Status = "blocked"
		return result, fmt.Errorf("push blocked: policy violation on %s", branch)

	case decision.RequiresApproval:
		cp, _ := o.RaiseCheckpoint(
			string(CheckpointMajorChange),
			fmt.Sprintf("push requires approval for %s on %s: %v", agentID, branch, decision.Reasons),
			[]string{"Approve and push (use override)", "Deny push"},
		)
		if cp != nil {
			result.CheckpointID = cp.ID
		}
		result.Status = "approval_required"
		return result, nil

	default:
		gr, err := gitops.PushBranch(o.cfg.RepoRoot, branch)
		if err != nil {
			result.Status = "error"
			return result, fmt.Errorf("push failed: %w", err)
		}
		result.Status = "pushed"
		result.Output = gr.Output
		return result, nil
	}
}

// PushBranchForce pushes an agent's branch bypassing diff classification —
// intended for use after the user has explicitly resolved an approval checkpoint.
// It still enforces GuardPendingCheckpoints (so other unresolved gates still block)
// and never generates a --force push.
func (o *Orchestrator) PushBranchForce(agentID string) (*AgentPushResult, error) {
	if err := o.GuardPendingCheckpoints("push_branch"); err != nil {
		return nil, err
	}

	state, err := o.agentState(agentID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}
	branch := state.Branch
	if branch == "" {
		return nil, fmt.Errorf("agent %s has no branch recorded", agentID)
	}

	gr, err := gitops.PushBranch(o.cfg.RepoRoot, branch)
	if err != nil {
		return &AgentPushResult{AgentID: agentID, Branch: branch, Status: "error"}, fmt.Errorf("push failed: %w", err)
	}
	return &AgentPushResult{
		AgentID:  agentID,
		Branch:   branch,
		Status:   "pushed",
		Decision: &policy.PushDecision{Allowed: true, Kind: policy.DiffMinor},
		Output:   gr.Output,
	}, nil
}

// agentDiffFiles returns the list of changed file paths and the associated task
// for an agent — shared between PushBranch and ClassifyAgentDiff.
func (o *Orchestrator) agentDiffFiles(agentID string, state *sessions.AgentState) ([]string, *models.Task, error) {
	baseRef := gitops.BaseRef(o.cfg.RepoRoot)
	stat, err := gitops.Stat(o.cfg.RepoRoot, baseRef, state.Branch)
	if err != nil {
		return nil, nil, fmt.Errorf("diff stat: %w", err)
	}
	files := make([]string, len(stat.Files))
	for i, f := range stat.Files {
		files[i] = f.Path
	}

	var task *models.Task
	if state.TaskID != "" {
		if allTasks, err := o.Tasks(); err == nil {
			for i := range allTasks {
				if allTasks[i].ID == state.TaskID {
					task = &allTasks[i]
					break
				}
			}
		}
	}
	return files, task, nil
}
