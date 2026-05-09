package tasks

import (
	"fmt"
	"sync"

	"local-agent-orchestrator/internal/models"
)

type Service struct {
	mu   sync.RWMutex
	list *TaskList
}

func NewService(list *TaskList) *Service {
	return &Service{list: list}
}

func (s *Service) All() []models.Task {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Task, len(s.list.Tasks))
	copy(out, s.list.Tasks)
	return out
}

func (s *Service) ByID(id string) (*models.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.list.Tasks {
		if s.list.Tasks[i].ID == id {
			return &s.list.Tasks[i], nil
		}
	}
	return nil, fmt.Errorf("task not found: %s", id)
}

func (s *Service) Transition(id string, to models.TaskStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var task *models.Task
	for i := range s.list.Tasks {
		if s.list.Tasks[i].ID == id {
			task = &s.list.Tasks[i]
			break
		}
	}
	if task == nil {
		return fmt.Errorf("task not found: %s", id)
	}
	if err := ValidateTransition(task.Status, to); err != nil {
		return err
	}
	task.Status = to
	return nil
}

func (s *Service) ValidateDependencies() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	idSet := make(map[string]bool, len(s.list.Tasks))
	for _, t := range s.list.Tasks {
		idSet[t.ID] = true
	}
	for _, t := range s.list.Tasks {
		for _, dep := range t.DependsOn {
			if !idSet[dep] {
				return fmt.Errorf("task %s depends on unknown task %s", t.ID, dep)
			}
		}
	}
	return nil
}
