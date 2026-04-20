package sessions

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// LaunchConfig holds everything needed to start one agent session.
type LaunchConfig struct {
	AgentID              string
	Role                 string
	TaskID               string
	TaskFile             string
	RepoRoot             string
	BaseRef              string
	ScriptsDir           string
	// UseWindowsTerminal passes -PreferWindowsTerminal to launch-agent.ps1.
	// When false (default), the script auto-detects wt.exe availability.
	UseWindowsTerminal   bool
}

// LaunchedSession is returned by Launch and tracks the live process.
type LaunchedSession struct {
	AgentID   string
	Role      string
	TaskID    string
	Branch    string
	Worktree  string
	PID       int
	StartedAt time.Time
	cmd       *exec.Cmd
}

// Launch starts a PowerShell agent session using launch-agent.ps1 and
// registers it in the Store. It returns immediately; the agent runs
// asynchronously in its own window.
func Launch(cfg LaunchConfig, store *Store) (*LaunchedSession, error) {
	if cfg.BaseRef == "" {
		cfg.BaseRef = "main"
	}
	if cfg.ScriptsDir == "" {
		cfg.ScriptsDir = filepath.Join(cfg.RepoRoot, "scripts")
	}

	script := filepath.Join(cfg.ScriptsDir, "launch-agent.ps1")
	if _, err := os.Stat(script); err != nil {
		return nil, fmt.Errorf("launch script not found: %s", script)
	}

	args := []string{
		"-NoProfile",
		"-File", script,
		"-AgentId", cfg.AgentID,
		"-Role", cfg.Role,
		"-TaskId", cfg.TaskID,
		"-TaskFile", cfg.TaskFile,
		"-RepoRoot", cfg.RepoRoot,
		"-BaseRef", cfg.BaseRef,
	}
	if cfg.UseWindowsTerminal {
		args = append(args, "-PreferWindowsTerminal")
	}
	cmd := exec.Command("powershell", args...)
	cmd.Dir = cfg.RepoRoot

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("launch agent %s: %w", cfg.AgentID, err)
	}

	worktreeBase := filepath.Join(filepath.Dir(cfg.RepoRoot), "worktrees")
	worktree := filepath.Join(worktreeBase, cfg.AgentID)
	branch := agentBranch(cfg.Role, cfg.AgentID)

	sess := &LaunchedSession{
		AgentID:   cfg.AgentID,
		Role:      cfg.Role,
		TaskID:    cfg.TaskID,
		Branch:    branch,
		Worktree:  worktree,
		PID:       cmd.Process.Pid,
		StartedAt: time.Now(),
		cmd:       cmd,
	}

	store.Set(&AgentState{
		Agent:      cfg.AgentID,
		TaskID:     cfg.TaskID,
		State:      "idle",
		Cwd:        worktree,
		Branch:     branch,
		LastAction: "launched",
		Timestamp:  sess.StartedAt,
		PID:        sess.PID,
	})

	return sess, nil
}

// LaunchMany starts multiple agent sessions in parallel.
// It collects all errors but still returns successfully launched sessions.
func LaunchMany(cfgs []LaunchConfig, store *Store) ([]*LaunchedSession, []error) {
	type result struct {
		sess *LaunchedSession
		err  error
	}
	results := make([]result, len(cfgs))
	var wg sync.WaitGroup
	for i, cfg := range cfgs {
		wg.Add(1)
		go func(i int, cfg LaunchConfig) {
			defer wg.Done()
			s, err := Launch(cfg, store)
			results[i] = result{sess: s, err: err}
		}(i, cfg)
	}
	wg.Wait()

	var out []*LaunchedSession
	var errs []error
	for _, r := range results {
		if r.err != nil {
			errs = append(errs, r.err)
		} else if r.sess != nil {
			out = append(out, r.sess)
		}
	}
	return out, errs
}

// agentBranch derives the git branch name from role and agent ID,
// matching the convention in launch-agent.ps1.
func agentBranch(role, agentID string) string {
	// e.g. role=worker, agentID=agent-worker-01 → agent/worker-01
	prefix := "agent-" + role + "-"
	suffix := agentID
	if len(agentID) > len(prefix) && agentID[:len(prefix)] == prefix {
		suffix = agentID[len(prefix):]
	}
	return "agent/" + role + "-" + suffix
}
