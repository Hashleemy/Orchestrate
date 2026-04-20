package sessions

import (
	"sync"
	"time"
)

type AgentState struct {
	Agent      string    `json:"agent"`
	TaskID     string    `json:"task_id"`
	State      string    `json:"state"`
	Cwd        string    `json:"cwd"`
	Branch     string    `json:"branch"`
	LastAction string    `json:"last_action"`
	Timestamp  time.Time `json:"timestamp"`
	PID        int       `json:"pid,omitempty"`
	Stale      bool      `json:"stale,omitempty"`
}

type Store struct {
	mu     sync.RWMutex
	agents map[string]*AgentState
}

func NewStore() *Store {
	return &Store{agents: make(map[string]*AgentState)}
}

func (s *Store) Set(state *AgentState) {
	s.mu.Lock()
	s.agents[state.Agent] = state
	s.mu.Unlock()
}

func (s *Store) Get(agentID string) (*AgentState, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	a, ok := s.agents[agentID]
	return a, ok
}

func (s *Store) All() []*AgentState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*AgentState, 0, len(s.agents))
	for _, a := range s.agents {
		out = append(out, a)
	}
	return out
}

func (s *Store) Remove(agentID string) {
	s.mu.Lock()
	delete(s.agents, agentID)
	s.mu.Unlock()
}
