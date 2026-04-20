package orchestrator

import (
	"fmt"
	"path/filepath"
	"strings"

	"local-agent-orchestrator/internal/sessions"
)

// RespawnResult is returned by RespawnAgent.
type RespawnResult struct {
	AgentID string `json:"agent_id"`
	PID     int    `json:"pid"`
	TaskID  string `json:"task_id"`
	Branch  string `json:"branch"`
	Role    string `json:"role"`
}

// RespawnAgent launches a fresh session for an existing agent ID, reusing
// the same task and branch recorded in its last status file.
// The caller (handler) is responsible for killing the old process first.
func (o *Orchestrator) RespawnAgent(agentID string) (*sessions.LaunchedSession, error) {
	state, err := o.agentState(agentID)
	if err != nil {
		return nil, fmt.Errorf("agent state not found: %w", err)
	}

	role := roleFromAgentID(agentID)
	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")

	return sessions.Launch(sessions.LaunchConfig{
		AgentID:            agentID,
		Role:               role,
		TaskID:             state.TaskID,
		TaskFile:           tasksFile,
		RepoRoot:           o.cfg.RepoRoot,
		BaseRef:            "main",
		UseWindowsTerminal: o.cfg.UseWindowsTerminal,
	}, o.sessions)
}

// roleFromAgentID derives the role string from a conventional agent ID.
// e.g. "agent-worker-01" → "worker", "agent-coordinator-01" → "coordinator"
func roleFromAgentID(agentID string) string {
	s := strings.TrimPrefix(agentID, "agent-")
	// Strip trailing two-digit numeric suffix (e.g. "-01")
	if i := strings.LastIndex(s, "-"); i > 0 {
		suffix := s[i+1:]
		allDigits := len(suffix) > 0
		for _, c := range suffix {
			if c < '0' || c > '9' {
				allDigits = false
				break
			}
		}
		if allDigits {
			s = s[:i]
		}
	}
	return s
}
