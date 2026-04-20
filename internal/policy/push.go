package policy

import (
	"strings"

	"local-agent-orchestrator/internal/models"
)

// PushDecision is the result of evaluating whether a push should be allowed.
type PushDecision struct {
	Allowed          bool     `json:"allowed"`
	RequiresApproval bool     `json:"requires_approval"`
	Blocked          bool     `json:"blocked"`
	Kind             DiffKind `json:"kind"`
	Reasons          []string `json:"reasons"`
}

// EvaluatePush classifies changed files and returns a push decision for branch.
//
// Rules (in order of precedence):
//  1. Protected shared branches (main, master, integration) → always require approval.
//  2. Blocked diff (sensitive files touched) → blocked, no push.
//  3. Major diff → requires approval before pushing.
//  4. Minor diff → auto-push allowed.
//
// Force-push is never generated; callers must use standard git push.
func EvaluatePush(branch string, files []string, task *models.Task) *PushDecision {
	if isProtectedBranch(branch) {
		return &PushDecision{
			Allowed:          false,
			RequiresApproval: true,
			Kind:             DiffMajor,
			Reasons:          []string{"branch '" + branch + "' is a protected shared branch"},
		}
	}

	class := ClassifyFiles(files, task)

	switch class.Kind {
	case DiffBlocked:
		return &PushDecision{
			Blocked: true,
			Kind:    DiffBlocked,
			Reasons: class.Reasons,
		}
	case DiffMajor:
		return &PushDecision{
			RequiresApproval: true,
			Kind:             DiffMajor,
			Reasons:          class.Reasons,
		}
	default:
		return &PushDecision{
			Allowed: true,
			Kind:    DiffMinor,
			Reasons: class.Reasons,
		}
	}
}

// isProtectedBranch returns true for shared branches that must never be pushed
// to without explicit user approval.
func isProtectedBranch(branch string) bool {
	switch strings.ToLower(branch) {
	case "main", "master", "integration", "develop", "dev", "staging", "production":
		return true
	}
	return false
}
