package models

type AgentRole string

const (
	RoleCoordinator AgentRole = "coordinator"
	RoleWorker      AgentRole = "worker"
	RoleReviewer    AgentRole = "reviewer"
)

type AgentStatus string

const (
	AgentIdle    AgentStatus = "idle"
	AgentRunning AgentStatus = "running"
	AgentBlocked AgentStatus = "blocked"
	AgentStopped AgentStatus = "stopped"
)

type Agent struct {
	Name        string      `json:"name"`
	Role        AgentRole   `json:"role"`
	Status      AgentStatus `json:"status"`
	TaskID      string      `json:"task_id"`
	Branch      string      `json:"branch"`
	Worktree    string      `json:"worktree"`
	ProcessID   int         `json:"process_id"`
	LastMessage string      `json:"last_message"`
}
