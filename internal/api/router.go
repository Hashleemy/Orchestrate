package api

import "local-agent-orchestrator/internal/uiembed"

func (s *Server) registerRoutes() {
	h := &handlers{orch: s.orch, svc: s.svc, srv: s}

	// Health & status
	s.mux.HandleFunc("GET /api/status", h.Status)
	s.mux.HandleFunc("GET /api/health", h.Health)

	// Repo management
	s.mux.HandleFunc("POST /api/repo/open", h.RepoOpen)
	s.mux.HandleFunc("POST /api/repo/pick", h.RepoPick)

	// Run control
	s.mux.HandleFunc("POST /api/run/start", h.StartRun)
	s.mux.HandleFunc("POST /api/run/stop", h.StopRun)

	// Task mutations
	s.mux.HandleFunc("POST /api/tasks", h.CreateTask)
	s.mux.HandleFunc("POST /api/tasks/{id}/status", h.UpdateTaskStatus)

	// Read endpoints
	s.mux.HandleFunc("GET /api/agents", h.Agents)
	s.mux.HandleFunc("GET /api/agents/{id}/diff", h.AgentDiff)
	s.mux.HandleFunc("GET /api/tasks", h.Tasks)
	s.mux.HandleFunc("GET /api/events", h.Events)
	s.mux.HandleFunc("GET /api/messages", h.Messages)
	s.mux.HandleFunc("GET /api/approvals", h.Approvals)
	s.mux.HandleFunc("GET /api/checkpoints", h.Checkpoints)
	s.mux.HandleFunc("GET /api/summary", h.Summary)

	// Approval actions
	s.mux.HandleFunc("POST /api/approvals/{id}/approve", h.Approve)
	s.mux.HandleFunc("POST /api/approvals/{id}/deny", h.Deny)

	// Checkpoint actions
	s.mux.HandleFunc("POST /api/checkpoints/{id}/resolve", h.ResolveCheckpoint)

	// Run history
	s.mux.HandleFunc("GET /api/runs", h.Runs)
	s.mux.HandleFunc("GET /api/runs/{id}", h.RunDetail)

	// Agent actions
	s.mux.HandleFunc("GET  /api/agents/{id}/logs",    h.AgentLogs)
	s.mux.HandleFunc("POST /api/agents/{id}/push",    h.PushBranch)
	s.mux.HandleFunc("POST /api/agents/{id}/respawn", h.RespawnAgent)
	s.mux.HandleFunc("POST /api/agents/{id}/merge",   h.MergeBranch)

	// Reviewer
	s.mux.HandleFunc("POST /api/agents/{id}/review", h.StartReview)
	s.mux.HandleFunc("GET /api/reviews", h.Reviews)

	// SSE stream
	s.mux.HandleFunc("GET /api/stream", h.Stream)

	// UI (must be last — catch-all)
	s.mux.Handle("/", uiembed.Handler())
}
