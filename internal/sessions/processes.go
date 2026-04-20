package sessions

import (
	"os"
	"sync"
	"time"
)

// ProcessRegistry tracks live agent processes so the orchestrator can detect
// crashes, query liveness, and terminate sessions cleanly.
type ProcessRegistry struct {
	mu      sync.RWMutex
	entries map[string]*processEntry
}

type processEntry struct {
	agentID   string
	pid       int
	process   *os.Process
	startedAt time.Time
	done      chan struct{}
	exitErr   error
}

// NewProcessRegistry creates an empty registry.
func NewProcessRegistry() *ProcessRegistry {
	return &ProcessRegistry{entries: make(map[string]*processEntry)}
}

// Register adds a launched session's process to the registry and starts a
// background goroutine that marks the session dead when the process exits.
func (r *ProcessRegistry) Register(sess *LaunchedSession, store *Store) {
	if sess.cmd == nil || sess.cmd.Process == nil {
		return
	}

	entry := &processEntry{
		agentID:   sess.AgentID,
		pid:       sess.PID,
		process:   sess.cmd.Process,
		startedAt: sess.StartedAt,
		done:      make(chan struct{}),
	}

	r.mu.Lock()
	r.entries[sess.AgentID] = entry
	r.mu.Unlock()

	go func() {
		state, err := sess.cmd.Process.Wait()
		entry.exitErr = err
		_ = state
		close(entry.done)

		// Update store to reflect the dead session.
		if existing, ok := store.Get(sess.AgentID); ok {
			existing.State = "stopped"
			existing.LastAction = "process exited"
			existing.Timestamp = time.Now()
			store.Set(existing)
		}

		r.mu.Lock()
		delete(r.entries, sess.AgentID)
		r.mu.Unlock()
	}()
}

// IsAlive reports whether the agent process is still running.
func (r *ProcessRegistry) IsAlive(agentID string) bool {
	r.mu.RLock()
	entry, ok := r.entries[agentID]
	r.mu.RUnlock()
	if !ok {
		return false
	}
	select {
	case <-entry.done:
		return false
	default:
		return true
	}
}

// Kill sends SIGKILL to the agent process.
func (r *ProcessRegistry) Kill(agentID string) error {
	r.mu.RLock()
	entry, ok := r.entries[agentID]
	r.mu.RUnlock()
	if !ok {
		return nil
	}
	return entry.process.Kill()
}

// KillAll terminates every registered agent process.
func (r *ProcessRegistry) KillAll() {
	r.mu.RLock()
	entries := make([]*processEntry, 0, len(r.entries))
	for _, e := range r.entries {
		entries = append(entries, e)
	}
	r.mu.RUnlock()
	for _, e := range entries {
		_ = e.process.Kill()
	}
}

// LiveAgents returns the agent IDs of processes still running.
func (r *ProcessRegistry) LiveAgents() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []string
	for id, entry := range r.entries {
		select {
		case <-entry.done:
		default:
			out = append(out, id)
		}
	}
	return out
}

// WaitFor blocks until the given agent's process exits or the timeout elapses.
// Returns true if the process exited within the timeout.
func (r *ProcessRegistry) WaitFor(agentID string, timeout time.Duration) bool {
	r.mu.RLock()
	entry, ok := r.entries[agentID]
	r.mu.RUnlock()
	if !ok {
		return true
	}
	select {
	case <-entry.done:
		return true
	case <-time.After(timeout):
		return false
	}
}
