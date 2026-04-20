package models

type TaskStatus string

const (
	TaskTodo             TaskStatus = "todo"
	TaskReady            TaskStatus = "ready"
	TaskInProgress       TaskStatus = "in_progress"
	TaskBlocked          TaskStatus = "blocked"
	TaskAwaitingReview   TaskStatus = "awaiting_review"
	TaskAwaitingApproval TaskStatus = "awaiting_approval"
	TaskDone             TaskStatus = "done"
	TaskCancelled        TaskStatus = "cancelled"
)

type Task struct {
	ID          string     `json:"id"`
	Status      TaskStatus `json:"status"`
	Priority    string     `json:"priority"`
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	Owner       string     `json:"owner"`
	Branch      string     `json:"branch"`
	Worktree    string     `json:"worktree"`
	DependsOn   []string   `json:"depends_on"`
	BlockedBy   []string   `json:"blocked_by"`
	Files       []string   `json:"files"`
	Acceptance  []string   `json:"acceptance"`
	Risk        string     `json:"risk"`
	MajorChange bool       `json:"major_change"`
	Notes       []string   `json:"notes"`
}
