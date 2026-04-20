package orchestrator

import (
	"fmt"
	"os"
	"path/filepath"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/parser"
	"local-agent-orchestrator/internal/tasks"
)

// AgentLogPath returns the path to the JSONL event file for the given agent.
func (o *Orchestrator) AgentLogPath(agentID string) string {
	return filepath.Join(o.cfg.CommsDir, "events", agentID+".jsonl")
}

// UpdateTaskStatus sets the status of an existing task in tasks.md.
// Returns the updated task or an error if the ID is unknown or the status invalid.
func (o *Orchestrator) UpdateTaskStatus(id string, status string) (*models.Task, error) {
	if id == "" {
		return nil, fmt.Errorf("task id is required")
	}
	if !isValidTaskStatus(status) {
		return nil, fmt.Errorf("invalid status %q", status)
	}

	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")
	existing, rules, err := o.readTasksWithRules(tasksFile)
	if err != nil {
		return nil, fmt.Errorf("read tasks: %w", err)
	}

	var updated *models.Task
	for i := range existing {
		if existing[i].ID == id {
			existing[i].Status = models.TaskStatus(status)
			updated = &existing[i]
			break
		}
	}
	if updated == nil {
		return nil, fmt.Errorf("task %s not found", id)
	}

	content := tasks.SerializeTasks(rules, existing)
	if err := os.WriteFile(tasksFile, []byte(content), 0644); err != nil {
		return nil, fmt.Errorf("write tasks.md: %w", err)
	}
	return updated, nil
}

func isValidTaskStatus(s string) bool {
	switch models.TaskStatus(s) {
	case models.TaskTodo, models.TaskReady, models.TaskInProgress,
		models.TaskBlocked, models.TaskAwaitingReview,
		models.TaskAwaitingApproval, models.TaskDone, models.TaskCancelled:
		return true
	}
	return false
}

// CreateTask appends a new task to tasks.md and returns the created task.
// The new task is assigned the next available TASK-NNN ID and starts as "ready".
func (o *Orchestrator) CreateTask(title, priority, risk, owner string, dependsOn []string) (*models.Task, error) {
	if title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if priority == "" {
		priority = "normal"
	}
	if risk == "" {
		risk = "low"
	}
	if dependsOn == nil {
		dependsOn = []string{}
	}

	tasksFile := filepath.Join(o.cfg.CommsDir, "tasks", "tasks.md")

	existing, rules, err := o.readTasksWithRules(tasksFile)
	if err != nil {
		return nil, fmt.Errorf("read tasks: %w", err)
	}

	task := models.Task{
		ID:        nextTaskID(existing),
		Status:    models.TaskReady,
		Priority:  priority,
		Type:      "feature",
		Title:     title,
		Owner:     owner,
		DependsOn: dependsOn,
		BlockedBy: []string{},
		Files:     []string{},
		Risk:      risk,
	}

	all := append(existing, task)
	content := tasks.SerializeTasks(rules, all)
	if err := os.WriteFile(tasksFile, []byte(content), 0644); err != nil {
		return nil, fmt.Errorf("write tasks.md: %w", err)
	}
	return &task, nil
}

func (o *Orchestrator) readTasksWithRules(tasksFile string) ([]models.Task, []string, error) {
	data, err := os.ReadFile(tasksFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, nil
		}
		return nil, nil, err
	}
	list, err := parser.Parse(string(data))
	if err != nil {
		return nil, nil, err
	}
	return list.Tasks, list.GlobalRules, nil
}

func nextTaskID(existing []models.Task) string {
	max := 0
	for _, t := range existing {
		var n int
		if _, err := fmt.Sscanf(t.ID, "TASK-%d", &n); err == nil && n > max {
			max = n
		}
	}
	return fmt.Sprintf("TASK-%03d", max+1)
}
