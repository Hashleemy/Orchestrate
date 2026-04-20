package api

import (
	"encoding/json"
	"fmt"
	"net/http"
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

// StopRun terminates all live agent processes and cleans up worktrees.
func (h *handlers) StopRun(w http.ResponseWriter, r *http.Request) {
	killed := h.srv.procs.LiveAgents()
	h.srv.procs.KillAll()
	cleanup := h.orch.StopRun()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":        "stopped",
		"agents_killed": killed,
		"cleanup":       cleanup,
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

func (h *handlers) StartRun(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Tasks       string `json:"tasks"`
		WorkerCount int    `json:"worker_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "expected {tasks: string}")
		return
	}
	if body.Tasks == "" {
		writeError(w, http.StatusBadRequest, "tasks content is required")
		return
	}

	if body.WorkerCount > 0 {
		result, err := h.orch.SpawnWorkers(body.Tasks, body.WorkerCount)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if result.Coordinator != nil {
			h.srv.procs.Register(result.Coordinator, h.srv.store)
		}
		for _, sess := range result.Workers {
			h.srv.procs.Register(sess, h.srv.store)
		}
		workerIDs := make([]string, len(result.Workers))
		for i, sess := range result.Workers {
			workerIDs[i] = sess.AgentID
		}
		coordID := ""
		if result.Coordinator != nil {
			coordID = result.Coordinator.AgentID
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":      "started",
			"coordinator": coordID,
			"workers":     workerIDs,
			"errors":      result.Errors,
		})
		return
	}

	if err := h.orch.StartRun(body.Tasks); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "started"})
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
