package policy

import "local-agent-orchestrator/internal/models"

// IsMajorChange returns true when a task is flagged as a major change
// or its risk level is high.
func IsMajorChange(t models.Task) bool {
	return t.MajorChange || t.Risk == "high"
}
