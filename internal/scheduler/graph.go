package scheduler

import (
	"fmt"

	"local-agent-orchestrator/internal/models"
)

// DetectCycle returns an error if the dependency graph contains a cycle.
func DetectCycle(taskSlice []models.Task) error {
	graph := make(map[string][]string, len(taskSlice))
	for _, t := range taskSlice {
		graph[t.ID] = t.DependsOn
	}

	const (
		unvisited = 0
		visiting  = 1
		visited   = 2
	)
	state := make(map[string]int, len(taskSlice))

	var dfs func(id string) error
	dfs = func(id string) error {
		switch state[id] {
		case visiting:
			return fmt.Errorf("circular dependency detected at task %s", id)
		case visited:
			return nil
		}
		state[id] = visiting
		for _, dep := range graph[id] {
			if err := dfs(dep); err != nil {
				return err
			}
		}
		state[id] = visited
		return nil
	}

	for _, t := range taskSlice {
		if err := dfs(t.ID); err != nil {
			return err
		}
	}
	return nil
}

// ReadyIDs returns the IDs of todo tasks whose every dependency is done.
func ReadyIDs(taskSlice []models.Task) []string {
	done := make(map[string]bool, len(taskSlice))
	for _, t := range taskSlice {
		if t.Status == models.TaskDone {
			done[t.ID] = true
		}
	}

	var ready []string
	for _, t := range taskSlice {
		if t.Status != models.TaskTodo {
			continue
		}
		allDone := true
		for _, dep := range t.DependsOn {
			if !done[dep] {
				allDone = false
				break
			}
		}
		if allDone {
			ready = append(ready, t.ID)
		}
	}
	return ready
}
