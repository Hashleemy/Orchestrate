package approvals

import "local-agent-orchestrator/internal/policy"

type Service struct {
	queue *Queue
}

func NewService() *Service {
	return &Service{queue: NewQueue()}
}

func (s *Service) Request(trigger policy.CheckpointTrigger, agentName, taskID, detail string) *Approval {
	return s.queue.Enqueue(trigger, agentName, taskID, detail)
}

func (s *Service) Approve(id string) error {
	return s.queue.Resolve(id, true)
}

func (s *Service) Deny(id string) error {
	return s.queue.Resolve(id, false)
}

func (s *Service) Pending() []*Approval {
	return s.queue.Pending()
}

func (s *Service) All() []*Approval {
	return s.queue.All()
}
