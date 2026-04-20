package approvals

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"local-agent-orchestrator/internal/policy"
)

type Queue struct {
	mu    sync.Mutex
	items map[string]*Approval
}

func NewQueue() *Queue {
	return &Queue{items: make(map[string]*Approval)}
}

func (q *Queue) Enqueue(trigger policy.CheckpointTrigger, agentName, taskID, detail string) *Approval {
	a := &Approval{
		ID:        newID(),
		Trigger:   trigger,
		AgentName: agentName,
		TaskID:    taskID,
		Detail:    detail,
		Status:    ApprovalPending,
		CreatedAt: time.Now(),
	}
	q.mu.Lock()
	q.items[a.ID] = a
	q.mu.Unlock()
	return a
}

func (q *Queue) Resolve(id string, approved bool) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	a, ok := q.items[id]
	if !ok {
		return fmt.Errorf("approval not found: %s", id)
	}
	now := time.Now()
	a.ResolvedAt = &now
	if approved {
		a.Status = ApprovalApproved
	} else {
		a.Status = ApprovalDenied
	}
	return nil
}

func (q *Queue) Pending() []*Approval {
	q.mu.Lock()
	defer q.mu.Unlock()
	var out []*Approval
	for _, a := range q.items {
		if a.Status == ApprovalPending {
			out = append(out, a)
		}
	}
	return out
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (q *Queue) All() []*Approval {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]*Approval, 0, len(q.items))
	for _, a := range q.items {
		out = append(out, a)
	}
	return out
}
