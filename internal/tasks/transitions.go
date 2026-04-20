package tasks

import (
	"fmt"

	"local-agent-orchestrator/internal/models"
)

var allowedTransitions = map[models.TaskStatus]map[models.TaskStatus]bool{
	models.TaskTodo: {
		models.TaskReady: true,
	},
	models.TaskReady: {
		models.TaskInProgress: true,
		models.TaskCancelled:  true,
	},
	models.TaskInProgress: {
		models.TaskBlocked:          true,
		models.TaskAwaitingReview:   true,
		models.TaskAwaitingApproval: true,
		models.TaskCancelled:        true,
	},
	models.TaskBlocked: {
		models.TaskReady: true,
	},
	models.TaskAwaitingReview: {
		models.TaskDone:       true,
		models.TaskInProgress: true,
	},
	models.TaskAwaitingApproval: {
		models.TaskReady: true,
	},
}

func ValidateTransition(from, to models.TaskStatus) error {
	if from == to {
		return nil
	}
	if allowedTransitions[from][to] {
		return nil
	}
	return fmt.Errorf("invalid task transition: %s -> %s", from, to)
}
