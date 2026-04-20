package tasks

import "local-agent-orchestrator/internal/models"

type TaskList struct {
	GlobalRules []string
	Tasks       []models.Task
}
