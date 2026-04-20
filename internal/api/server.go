package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"local-agent-orchestrator/internal/approvals"
	"local-agent-orchestrator/internal/config"
	"local-agent-orchestrator/internal/orchestrator"
	"local-agent-orchestrator/internal/sessions"
)

type Server struct {
	addr     string
	mux      *http.ServeMux
	orch     *orchestrator.Orchestrator
	svc      *approvals.Service
	store    *sessions.Store
	procs    *sessions.ProcessRegistry

	mu       sync.RWMutex
	repoPath string
}

func NewServer() (*Server, error) {
	repoRoot, err := findRepoRoot()
	if err != nil {
		return nil, err
	}

	// If REPO_ROOT wasn't explicitly set, prefer a previously-saved path.
	if os.Getenv("REPO_ROOT") == "" {
		if saved, err := config.Load(); err == nil && saved.RepoPath != "" {
			repoRoot = saved.RepoPath
		}
	}

	commsDir := filepath.Join(repoRoot, "agent-comms")

	store := sessions.NewStore()
	svc   := approvals.NewService()
	orch  := orchestrator.New(orchestrator.Config{
		CommsDir:           commsDir,
		RepoRoot:           repoRoot,
		UseWindowsTerminal: os.Getenv("USE_WINDOWS_TERMINAL") == "1",
	}, store, svc)

	addr := os.Getenv("ORCHESTRATOR_ADDR")
	if addr == "" {
		addr = "0.0.0.0:8080"
	}

	s := &Server{
		addr:     addr,
		mux:      http.NewServeMux(),
		orch:     orch,
		svc:      svc,
		store:    store,
		procs:    sessions.NewProcessRegistry(),
		repoPath: repoRoot,
	}
	s.registerRoutes()
	return s, nil
}

func (s *Server) Start() error {
	log.Printf("orchestrator listening on http://%s", s.addr)
	return http.ListenAndServe(s.addr, cors(s.mux))
}

func (s *Server) getRepoPath() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.repoPath
}

func (s *Server) setRepoPath(p string) {
	s.mu.Lock()
	s.repoPath = p
	s.mu.Unlock()
	_ = config.Save(&config.Saved{RepoPath: p})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func findRepoRoot() (string, error) {
	if root := os.Getenv("REPO_ROOT"); root != "" {
		return root, nil
	}
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return os.Getwd()
}
