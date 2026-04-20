package tasks

import (
	"fmt"

	"local-agent-orchestrator/internal/models"
)

type Service struct {
	list *TaskList
}

func NewService(list *TaskList) *Service {
	return &Service{list: list}
}

func (s *Service) All() []models.Task {
	return s.list.Tasks
}

func (s *Service) ByID(id string) (*models.Task, error) {
	for i := range s.list.Tasks {
		if s.list.Tasks[i].ID == id {
			return &s.list.Tasks[i], nil
		}
	}
	return nil, fmt.Errorf("task not found: %s", id)
}

func (s *Service) Transition(id string, to models.TaskStatus) error {
	task, err := s.ByID(id)
	if err != nil {
		return err
	}
	if err := ValidateTransition(task.Status, to); err != nil {
		return err
	}
	task.Status = to
	return nil
}

func (s *Service) ValidateDependencies() error {
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
