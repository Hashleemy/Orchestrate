package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"time"

	"local-agent-orchestrator/internal/approvals"
	"local-agent-orchestrator/internal/gitops"
	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/orchestrator"
	"local-agent-orchestrator/internal/sessions"
)

type handlers struct {
	orch *orchestrator.Orchestrator
	svc  *approvals.Service
	srv  *Server
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Status returns a health check response.
func (h *handlers) Status(w http.ResponseWriter, r *http.Request) {
	repoPath := h.srv.getRepoPath()
	branch, _ := gitops.CurrentBranch(repoPath)
	clean, _ := gitops.IsClean(repoPath)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"service":   "local-agent-orchestrator",
		"repo_path": repoPath,
		"branch":    branch,
		"clean":     clean,
	})
}

// Health reports server version, uptime, go version, and live agent count.
func (h *handlers) Health(w http.ResponseWriter, r *http.Request) {
	agents, _ := h.orch.AgentStatuses()
	alive := 0
	for _, a := range agents {
		if h.srv.procs.IsAlive(a.Agent) {
			alive++
		}
	}
	uptime := time.Since(h.srv.startedAt)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"version":      "0.1.0",
		"go_version":   runtime.Version(),
		"started_at":   h.srv.startedAt.Format(time.RFC3339),
		"uptime_sec":   int(uptime.Seconds()),
		"agents_alive": alive,
	})
}

// RepoOpen validates a repo path and sets it as the active repository.
func (h *handlers) RepoOpen(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		writeError(w, http.StatusBadRequest, "expected {path: string}")
		return
	}
	if !gitops.IsRepo(body.Path) {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("not a git repository: %s", body.Path))
		return
	}
	branch, err := gitops.CurrentBranch(body.Path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	clean, _ := gitops.IsClean(body.Path)
	h.srv.setRepoPath(body.Path)
	writeJSON(w, http.StatusOK, map[string]any{
		"path":   body.Path,
		"branch": branch,
		"clean":  clean,
	})
}

// RepoPick opens a native OS folder picker and returns the selected path.
// An empty path in the response means the user cancelled.
func (h *handlers) RepoPick(w http.ResponseWriter, r *http.Request) {
	path, err := pickFolder()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
}

// StopRun terminates all live agent processes, writes a session summary
// markdown file, and cleans up worktrees.
func (h *handlers) StopRun(w http.ResponseWriter, r *http.Request) {
	killed := h.srv.procs.LiveAgents()
	h.srv.procs.KillAll()
	cleanup := h.orch.StopRun()
	summaryPath, _ := cleanup["session_summary_path"].(string)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":               "stopped",
		"agents_killed":        killed,
		"session_summary_path": summaryPath,
		"cleanup":              cleanup,
	})
}

// agentInfo enriches an AgentState with live process information.
type agentInfo struct {
	*sessions.AgentState
	Alive bool `json:"alive"`
}

func (h *handlers) enrichAgents(agents []*sessions.AgentState) []agentInfo {
	out := make([]agentInfo, len(agents))
	for i, a := range agents {
		out[i] = agentInfo{AgentState: a, Alive: h.srv.procs.IsAlive(a.Agent)}
	}
	return out
}

func (h *handlers) Agents(w http.ResponseWriter, r *http.Request) {
	agents, err := h.orch.AgentStatuses()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if agents == nil {
		agents = []*sessions.AgentState{}
	}
	writeJSON(w, http.StatusOK, h.enrichAgents(agents))
}

func (h *handlers) Events(w http.ResponseWriter, r *http.Request) {
	events, err := h.orch.Events()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if events == nil {
		events = []orchestrator.Event{}
	}
	writeJSON(w, http.StatusOK, events)
}

func (h *handlers) Messages(w http.ResponseWriter, r *http.Request) {
	msgs, err := h.orch.Messages()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if msgs == nil {
		msgs = []map[string]any{}
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (h *handlers) Tasks(w http.ResponseWriter, r *http.Request) {
	tasks, err := h.orch.Tasks()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tasks == nil {
		tasks = []models.Task{}
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *handlers) Approvals(w http.ResponseWriter, r *http.Request) {
	items, err := h.orch.FileApprovals()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []*orchestrator.FileApproval{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *handlers) Checkpoints(w http.ResponseWriter, r *http.Request) {
	all, err := h.orch.AllCheckpoints()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if all == nil {
		all = []*orchestrator.Checkpoint{}
	}
	writeJSON(w, http.StatusOK, all)
}

func (h *handlers) ResolveCheckpoint(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Choice string `json:"choice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Choice == "" {
		writeError(w, http.StatusBadRequest, "expected {choice: string}")
		return
	}
	if err := h.orch.ResolveCheckpoint(id, body.Choice); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resolved"})
}

func (h *handlers) Summary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.orch.BuildSummary()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if r.URL.Query().Get("format") == "text" {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(orchestrator.FormatSummary(summary)))
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// StartRun accepts a free-text project description, an optional GitHub SSH
// repo URL, and a worker count. It clones the repo if needed, then spawns
// the coordinator agent which generates tasks and drives the project to completion.
func (h *handlers) StartRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Description string `json:"description"`
		WorkerCount int    `json:"worker_count"`
		RepoURL     string `json:"repo_url"`
		RepoPath    string `json:"repo_path"`
		// Legacy field — still accepted so old clients don't break.
		Tasks string `json:"tasks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Fall back to legacy tasks field if description is empty.
	if body.Description == "" && body.Tasks != "" {
		body.Description = body.Tasks
	}
	if body.Description == "" {
		writeError(w, http.StatusBadRequest, "description is required")
		return
	}

	// If caller specified a repo path, override the server's active path.
	if body.RepoPath != "" {
		h.srv.setRepoPath(body.RepoPath)
	}

	repoPath := h.srv.getRepoPath()
	if repoPath == "" {
		writeError(w, http.StatusBadRequest, "no project folder selected — set the repo path first")
		return
	}

	// Clone GitHub repo into the project folder if a URL was provided.
	if body.RepoURL != "" && !gitops.IsRepo(repoPath) {
		if err := h.orch.CloneRepo(body.RepoURL, repoPath); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("git clone failed: %s", err.Error()))
			return
		}
		// Re-validate after clone.
		if !gitops.IsRepo(repoPath) {
			writeError(w, http.StatusInternalServerError, "clone succeeded but path is not a git repo")
			return
		}
	}

	workerCount := body.WorkerCount
	if workerCount < 1 {
		workerCount = 1
	}

	result, err := h.orch.SpawnGoal(body.Description, workerCount, body.RepoURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if result.Coordinator != nil {
		h.srv.procs.Register(result.Coordinator, h.srv.store)
	}
	coordID := ""
	if result.Coordinator != nil {
		coordID = result.Coordinator.AgentID
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "started",
		"coordinator": coordID,
		"repo_path":   repoPath,
		"errors":      result.Errors,
	})
}

func (h *handlers) AgentDiff(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	summary, err := h.orch.ClassifyAgentDiff(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *handlers) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.orch.ResolveFileApproval(id, "approved"); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

func (h *handlers) Deny(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.orch.ResolveFileApproval(id, "denied"); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "denied"})
}

func (h *handlers) StartReview(w http.ResponseWriter, r *http.Request) {
	workerID := r.PathValue("id")
	var body struct {
		TaskID string `json:"task_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TaskID == "" {
		writeError(w, http.StatusBadRequest, "expected {task_id: string}")
		return
	}
	sess, err := h.orch.SpawnReviewer(workerID, body.TaskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.srv.procs.Register(sess, h.srv.store)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "reviewing",
		"reviewer_id": sess.AgentID,
		"worker_id":   workerID,
	})
}

func (h *handlers) AgentLogs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	logPath := h.orch.AgentLogPath(id)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	sessions.StreamAgentLog(r.Context(), logPath, w, flusher.Flush)
}

func (h *handlers) UpdateTaskStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		writeError(w, http.StatusBadRequest, "status is required")
		return
	}
	task, err := h.orch.UpdateTaskStatus(id, body.Status)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *handlers) CreateTask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title     string   `json:"title"`
		Priority  string   `json:"priority"`
		Risk      string   `json:"risk"`
		Owner     string   `json:"owner"`
		DependsOn []string `json:"depends_on"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	task, err := h.orch.CreateTask(body.Title, body.Priority, body.Risk, body.Owner, body.DependsOn)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *handlers) MergeBranch(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Into string `json:"into"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Into == "" {
		body.Into = "main"
	}
	result, err := h.orch.MergeAgentBranch(id, body.Into)
	if err != nil && result == nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	status := http.StatusOK
	if err != nil {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, result)
}

func (h *handlers) RespawnAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Kill old process first — ignore error if already dead.
	_ = h.srv.procs.Kill(id)

	sess, err := h.orch.RespawnAgent(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.srv.procs.Register(sess, h.srv.store)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "respawned",
		"agent_id": sess.AgentID,
		"pid":      sess.PID,
		"task_id":  sess.TaskID,
		"branch":   sess.Branch,
	})
}

func (h *handlers) PushBranch(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Force bool `json:"force"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	var (
		result *orchestrator.AgentPushResult
		err    error
	)
	if body.Force {
		result, err = h.orch.PushBranchForce(id)
	} else {
		result, err = h.orch.PushBranch(id)
	}
	if err != nil && result == nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	status := http.StatusOK
	if err != nil {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, result)
}

func (h *handlers) Reviews(w http.ResponseWriter, r *http.Request) {
	verdicts, err := h.orch.ReviewVerdicts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if verdicts == nil {
		verdicts = []*orchestrator.ReviewVerdict{}
	}
	requests, err := h.orch.ReviewRequests()
	if err != nil {
		requests = []*orchestrator.ReviewRequest{}
	}
	if requests == nil {
		requests = []*orchestrator.ReviewRequest{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"verdicts": verdicts,
		"requests": requests,
	})
}

func (h *handlers) Runs(w http.ResponseWriter, r *http.Request) {
	records, err := h.orch.RunRecords()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if records == nil {
		records = []*orchestrator.RunRecord{}
	}
	writeJSON(w, http.StatusOK, records)
}

func (h *handlers) RunDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rec, err := h.orch.RunRecord(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *handlers) Stream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	// Send initial keepalive so HTTP headers flush immediately.
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	fast := time.NewTicker(2 * time.Second)
	slow := time.NewTicker(10 * time.Second)
	defer fast.Stop()
	defer slow.Stop()

	send := func(event string, v any) {
		if data, err := json.Marshal(v); err == nil {
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
		}
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case <-fast.C:
			rawAgents, _ := h.orch.AgentStatuses()
			send("agents", map[string]any{"type": "agents", "data": h.enrichAgents(rawAgents)})

			events, _ := h.orch.Events()
			if events == nil {
				events = []orchestrator.Event{}
			}
			send("events", map[string]any{"type": "events", "data": events})

			approvalItems, _ := h.orch.FileApprovals()
			if approvalItems == nil {
				approvalItems = []*orchestrator.FileApproval{}
			}
			send("approvals", map[string]any{"type": "approvals", "data": approvalItems})

			msgs, _ := h.orch.Messages()
			if msgs == nil {
				msgs = []map[string]any{}
			}
			send("messages", map[string]any{"type": "messages", "data": msgs})

			verdicts, _ := h.orch.ReviewVerdicts()
			if verdicts == nil {
				verdicts = []*orchestrator.ReviewVerdict{}
			}
			reqs, _ := h.orch.ReviewRequests()
			if reqs == nil {
				reqs = []*orchestrator.ReviewRequest{}
			}
			send("reviews", map[string]any{"type": "reviews", "data": map[string]any{
				"verdicts": verdicts,
				"requests": reqs,
			}})

			flusher.Flush()
		case <-slow.C:
			tasks, _ := h.orch.Tasks()
			if tasks == nil {
				tasks = []models.Task{}
			}
			send("tasks", map[string]any{"type": "tasks", "data": tasks})

			checkpoints, _ := h.orch.ActiveCheckpoints()
			if checkpoints == nil {
				checkpoints = []*orchestrator.Checkpoint{}
			}
			send("checkpoints", map[string]any{"type": "checkpoints", "data": checkpoints})

			flusher.Flush()
		}
	}
}
