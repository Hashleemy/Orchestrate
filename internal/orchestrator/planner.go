package orchestrator

import (
	"path/filepath"
	"strings"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/scheduler"
)

// TaskAssignment pairs a task with the agent that should work on it.
type TaskAssignment struct {
	TaskID  string `json:"task_id"`
	AgentID string `json:"agent_id"`
	Branch  string `json:"branch"`
}

// ReadyTasks returns all tasks with status ready.
func (o *Orchestrator) ReadyTasks() ([]models.Task, error) {
	all, err := o.Tasks()
	if err != nil {
		return nil, err
	}
	var out []models.Task
	for _, t := range all {
		if t.Status == models.TaskReady {
			out = append(out, t)
		}
	}
	return out, nil
}

// BlockedTasks returns all tasks with status blocked.
func (o *Orchestrator) BlockedTasks() ([]models.Task, error) {
	all, err := o.Tasks()
	if err != nil {
		return nil, err
	}
	var out []models.Task
	for _, t := range all {
		if t.Status == models.TaskBlocked {
			out = append(out, t)
		}
	}
	return out, nil
}

// UnassignedReady returns ready tasks that have no owner assigned.
func (o *Orchestrator) UnassignedReady() ([]models.Task, error) {
	ready, err := o.ReadyTasks()
	if err != nil {
		return nil, err
	}
	var out []models.Task
	for _, t := range ready {
		if t.Owner == "" || t.Owner == "unassigned" {
			out = append(out, t)
		}
	}
	return out, nil
}

// SuggestAssignments returns up to agentCount task→agent assignments that
// minimise file-scope overlap between concurrent workers. Agent IDs are
// generated as "agent-worker-NN".
func (o *Orchestrator) SuggestAssignments(agentCount int) ([]TaskAssignment, error) {
	candidates, err := o.UnassignedReady()
	if err != nil {
		return nil, err
	}

	if err := validateNoCycles(candidates); err != nil {
		return nil, err
	}

	// Sort by priority (high first) without pulling in sort for a simple 3-tier.
	candidates = prioritySorted(candidates)

	var assignments []TaskAssignment
	claimedFiles := make(map[string]string) // file → taskID that owns it

	for i, task := range candidates {
		if i >= agentCount {
			break
		}
		if hasFileOverlap(task.Files, claimedFiles) {
			continue
		}
		agentID := agentID(i + 1)
		assignments = append(assignments, TaskAssignment{
			TaskID:  task.ID,
			AgentID: agentID,
			Branch:  "agent/" + agentID,
		})
		for _, f := range task.Files {
			claimedFiles[normalizeScope(f)] = task.ID
		}
	}
	return assignments, nil
}

func validateNoCycles(taskSlice []models.Task) error {
	return scheduler.DetectCycle(taskSlice)
}

func hasFileOverlap(files []string, claimed map[string]string) bool {
	for _, f := range files {
		scope := normalizeScope(f)
		for claimedScope := range claimed {
			if scopeOverlaps(scope, claimedScope) {
				return true
			}
		}
	}
	return false
}

// scopeOverlaps returns true when two file patterns share a directory prefix
// or one is a subpath of the other.
func scopeOverlaps(a, b string) bool {
	a = filepath.ToSlash(a)
	b = filepath.ToSlash(b)
	// Strip trailing /** or /*
	a = strings.TrimSuffix(strings.TrimSuffix(a, "/**"), "/*")
	b = strings.TrimSuffix(strings.TrimSuffix(b, "/**"), "/*")
	return strings.HasPrefix(a, b) || strings.HasPrefix(b, a)
}

func normalizeScope(f string) string {
	return filepath.ToSlash(strings.TrimSuffix(f, "/"))
}

func prioritySorted(tasks []models.Task) []models.Task {
	order := map[string]int{"high": 0, "medium": 1, "low": 2}
	out := make([]models.Task, len(tasks))
	copy(out, tasks)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && order[out[j].Priority] < order[out[j-1].Priority]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func agentID(n int) string {
	suffix := "0"
	if n < 10 {
		suffix = "0" + string(rune('0'+n))
	} else {
		suffix = string(rune('0'+n/10)) + string(rune('0'+n%10))
	}
	return "agent-worker-" + suffix
}
