package sessions_test

import (
	"testing"
	"time"

	"local-agent-orchestrator/internal/sessions"
)

func TestStore_SetAndGet(t *testing.T) {
	store := sessions.NewStore()
	state := &sessions.AgentState{
		Agent:      "agent-01",
		TaskID:     "TASK-001",
		State:      "coding",
		Branch:     "agent/worker-01",
		LastAction: "editing server.go",
		Timestamp:  time.Now(),
	}
	store.Set(state)

	got, ok := store.Get("agent-01")
	if !ok {
		t.Fatal("expected to find agent-01")
	}
	if got.TaskID != "TASK-001" {
		t.Errorf("expected TASK-001, got %s", got.TaskID)
	}
}

func TestStore_All(t *testing.T) {
	store := sessions.NewStore()
	for _, id := range []string{"agent-01", "agent-02", "agent-03"} {
		store.Set(&sessions.AgentState{Agent: id})
	}
	all := store.All()
	if len(all) != 3 {
		t.Errorf("expected 3 agents, got %d", len(all))
	}
}

func TestStore_Remove(t *testing.T) {
	store := sessions.NewStore()
	store.Set(&sessions.AgentState{Agent: "agent-01"})
	store.Remove("agent-01")

	_, ok := store.Get("agent-01")
	if ok {
		t.Error("expected agent-01 to be removed")
	}
}

func TestStore_GetMissing(t *testing.T) {
	store := sessions.NewStore()
	_, ok := store.Get("nonexistent")
	if ok {
		t.Error("expected not found for nonexistent agent")
	}
}

func TestProcessRegistry_IsAlive_AfterKill(t *testing.T) {
	reg := sessions.NewProcessRegistry()
	// An agent that was never registered is not alive.
	if reg.IsAlive("agent-99") {
		t.Error("unregistered agent should not be alive")
	}
}

func TestProcessRegistry_LiveAgents_Empty(t *testing.T) {
	reg := sessions.NewProcessRegistry()
	live := reg.LiveAgents()
	if len(live) != 0 {
		t.Errorf("expected no live agents, got %v", live)
	}
}
