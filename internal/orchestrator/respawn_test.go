package orchestrator

import "testing"

func TestRoleFromAgentID(t *testing.T) {
	cases := []struct {
		id   string
		want string
	}{
		{"agent-worker-01", "worker"},
		{"agent-coordinator-01", "coordinator"},
		{"agent-reviewer-worker-01", "reviewer-worker"},
		{"agent-backend-01", "backend"},
		{"agent-ui-01", "ui"},
	}
	for _, c := range cases {
		got := roleFromAgentID(c.id)
		if got != c.want {
			t.Errorf("roleFromAgentID(%q) = %q, want %q", c.id, got, c.want)
		}
	}
}
