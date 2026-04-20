package policy_test

import (
	"testing"

	"local-agent-orchestrator/internal/policy"
)

func TestEvaluatePush_MinorDiff_AutoAllowed(t *testing.T) {
	decision := policy.EvaluatePush("agent/worker-01", []string{"internal/api/handlers.go", "web/src/App.tsx"}, nil)
	if !decision.Allowed {
		t.Errorf("expected allowed, got blocked=%v approval=%v", decision.Blocked, decision.RequiresApproval)
	}
	if decision.Kind != policy.DiffMinor {
		t.Errorf("expected minor, got %s", decision.Kind)
	}
}

func TestEvaluatePush_MajorDiff_RequiresApproval(t *testing.T) {
	decision := policy.EvaluatePush("agent/worker-01", []string{"migrations/001_init.sql"}, nil)
	if !decision.RequiresApproval {
		t.Errorf("expected requires_approval, got allowed=%v blocked=%v", decision.Allowed, decision.Blocked)
	}
	if decision.Kind != policy.DiffMajor {
		t.Errorf("expected major, got %s", decision.Kind)
	}
}

func TestEvaluatePush_BlockedDiff_Blocked(t *testing.T) {
	decision := policy.EvaluatePush("agent/worker-01", []string{"secrets.env", "internal/api/server.go"}, nil)
	if !decision.Blocked {
		t.Errorf("expected blocked, got allowed=%v approval=%v", decision.Allowed, decision.RequiresApproval)
	}
	if decision.Kind != policy.DiffBlocked {
		t.Errorf("expected blocked kind, got %s", decision.Kind)
	}
}

func TestEvaluatePush_ProtectedBranch_RequiresApproval(t *testing.T) {
	for _, branch := range []string{"main", "master", "staging", "production", "develop"} {
		d := policy.EvaluatePush(branch, []string{"README.md"}, nil)
		if !d.RequiresApproval {
			t.Errorf("branch %q: expected requires_approval", branch)
		}
		if d.Kind != policy.DiffMajor {
			t.Errorf("branch %q: expected major kind, got %s", branch, d.Kind)
		}
	}
}

func TestEvaluatePush_ProtectedBranch_TakesPrecedenceOverMinor(t *testing.T) {
	d := policy.EvaluatePush("main", []string{"README.md"}, nil)
	if d.Allowed {
		t.Error("push to main should never be auto-allowed")
	}
}

func TestIsProtectedBranch_CaseInsensitive(t *testing.T) {
	d := policy.EvaluatePush("MAIN", []string{}, nil)
	if !d.RequiresApproval {
		t.Error("MAIN should be treated as protected branch")
	}
}

func TestEvaluatePush_EmptyFiles_Minor(t *testing.T) {
	d := policy.EvaluatePush("agent/worker-01", []string{}, nil)
	if !d.Allowed {
		t.Errorf("empty file list should be minor/allowed, got %+v", d)
	}
}
