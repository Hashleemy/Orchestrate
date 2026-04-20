package orchestrator

import (
	"fmt"

	"local-agent-orchestrator/internal/gitops"
)

// AgentMergeResult is returned by MergeAgentBranch.
type AgentMergeResult struct {
	AgentID    string `json:"agent_id"`
	Branch     string `json:"branch"`
	IntoBranch string `json:"into_branch"`
	Status     string `json:"status"` // "merged" | "conflicts" | "error"
	Conflicts  bool   `json:"conflicts"`
	Output     string `json:"output,omitempty"`
}

// MergeAgentBranch merges an agent's branch into intoBranch (e.g. "main").
// It enforces:
//  1. No pending checkpoints.
//  2. An approved reviewer verdict exists for the agent.
//  3. Dry-run conflict check passes before touching HEAD.
//
// The main repo's HEAD is restored to its previous branch after the merge.
func (o *Orchestrator) MergeAgentBranch(agentID, intoBranch string) (*AgentMergeResult, error) {
	if err := o.GuardPendingCheckpoints("merge_branch"); err != nil {
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

	result := &AgentMergeResult{AgentID: agentID, Branch: branch, IntoBranch: intoBranch}

	// Require an approved reviewer verdict for this agent.
	verdicts, err := o.ReviewVerdicts()
	if err != nil {
		return nil, fmt.Errorf("load verdicts: %w", err)
	}
	approved := false
	for _, v := range verdicts {
		if v.WorkerID == agentID && v.Verdict == "approve" {
			approved = true
			break
		}
	}
	if !approved {
		return nil, fmt.Errorf("no approved reviewer verdict for agent %s — request a review first", agentID)
	}

	// Conflict pre-check (no side effects).
	hasConflicts, err := gitops.DryRunMerge(o.cfg.RepoRoot, branch, intoBranch)
	if err != nil {
		return nil, fmt.Errorf("conflict check: %w", err)
	}
	if hasConflicts {
		result.Status = "conflicts"
		result.Conflicts = true
		return result, fmt.Errorf("merge would produce conflicts — resolve manually")
	}

	// Save current HEAD branch so we can restore it after.
	prev, _ := gitops.CurrentBranch(o.cfg.RepoRoot)

	if err := gitops.Checkout(o.cfg.RepoRoot, intoBranch); err != nil {
		return nil, fmt.Errorf("checkout %s: %w", intoBranch, err)
	}

	gr, mergeErr := gitops.MergeBranch(o.cfg.RepoRoot, branch, intoBranch)
	if gr != nil {
		result.Output = gr.Output
		result.Conflicts = gr.Conflicts
	}

	// Always try to restore the previous branch.
	if prev != "" && prev != intoBranch {
		_ = gitops.Checkout(o.cfg.RepoRoot, prev)
	}

	if mergeErr != nil {
		if gr != nil && gr.Conflicts {
			_ = gitops.AbortMerge(o.cfg.RepoRoot)
			result.Status = "conflicts"
		} else {
			result.Status = "error"
		}
		return result, mergeErr
	}

	result.Status = "merged"
	return result, nil
}
