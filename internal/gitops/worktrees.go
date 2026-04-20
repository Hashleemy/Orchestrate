package gitops

import (
	"fmt"
	"os/exec"
	"strings"
)

func CreateWorktree(repoPath, branch, worktreePath, baseRef string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", "-b", branch, worktreePath, baseRef)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("create worktree failed: %v: %s", err, string(output))
	}
	return nil
}

func RemoveWorktree(repoPath, worktreePath string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "remove", "--force", worktreePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("remove worktree failed: %v: %s", err, string(output))
	}
	return nil
}

func ListWorktrees(repoPath string) ([]string, error) {
	out, err := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain").Output()
	if err != nil {
		return nil, fmt.Errorf("list worktrees: %w", err)
	}
	var paths []string
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "worktree ") {
			paths = append(paths, strings.TrimPrefix(line, "worktree "))
		}
	}
	return paths, nil
}

// WorktreeExists reports whether a worktree at the given path is already
// registered with git.
func WorktreeExists(repoPath, worktreePath string) bool {
	out, err := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "worktree "+worktreePath)
}

// ReuseOrCreate reuses an existing worktree if it is already registered,
// otherwise creates a new one. Returns true when an existing worktree was
// reused.
func ReuseOrCreate(repoPath, branch, worktreePath, baseRef string) (reused bool, err error) {
	if WorktreeExists(repoPath, worktreePath) {
		return true, nil
	}
	return false, CreateWorktree(repoPath, branch, worktreePath, baseRef)
}

// CleanupWorktrees removes the worktree directory and its git registration
// for each path in paths. Errors are collected but do not stop cleanup of
// remaining worktrees.
func CleanupWorktrees(repoPath string, paths []string) []error {
	var errs []error
	for _, p := range paths {
		if err := RemoveWorktree(repoPath, p); err != nil {
			errs = append(errs, fmt.Errorf("remove %s: %w", p, err))
		}
	}
	// Always prune stale entries after removal attempts.
	if pruneErr := exec.Command("git", "-C", repoPath, "worktree", "prune").Run(); pruneErr != nil {
		errs = append(errs, fmt.Errorf("prune: %w", pruneErr))
	}
	return errs
}

// AgentWorktreePaths returns the paths of all worktrees whose branch name
// matches the agent/ prefix (i.e. agent-owned worktrees).
func AgentWorktreePaths(repoPath string) ([]string, error) {
	out, err := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain").Output()
	if err != nil {
		return nil, fmt.Errorf("list worktrees: %w", err)
	}

	var paths []string
	var currentPath string
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "worktree ") {
			currentPath = strings.TrimPrefix(line, "worktree ")
		}
		if strings.HasPrefix(line, "branch refs/heads/agent/") && currentPath != "" {
			paths = append(paths, currentPath)
			currentPath = ""
		}
	}
	return paths, nil
}
