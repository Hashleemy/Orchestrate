package gitops

import (
	"fmt"
	"os/exec"
	"strings"
)

type RepoStatus struct {
	Path          string          `json:"path"`
	CurrentBranch string          `json:"current_branch"`
	IsClean       bool            `json:"is_clean"`
	Worktrees     []WorktreeEntry `json:"worktrees"`
}

type WorktreeEntry struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Head   string `json:"head"`
	Bare   bool   `json:"bare"`
}

// Status returns a combined snapshot of repo cleanliness, branch, and worktrees.
func Status(repoPath string) (*RepoStatus, error) {
	branch, err := CurrentBranch(repoPath)
	if err != nil {
		return nil, err
	}
	clean, err := IsClean(repoPath)
	if err != nil {
		return nil, err
	}
	worktrees, err := WorktreeEntries(repoPath)
	if err != nil {
		return nil, err
	}
	return &RepoStatus{
		Path:          repoPath,
		CurrentBranch: branch,
		IsClean:       clean,
		Worktrees:     worktrees,
	}, nil
}

// WorktreeEntries returns structured metadata for every worktree in the repo.
func WorktreeEntries(repoPath string) ([]WorktreeEntry, error) {
	out, err := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain").Output()
	if err != nil {
		return nil, fmt.Errorf("worktree list: %w", err)
	}

	var entries []WorktreeEntry
	var current WorktreeEntry

	for _, line := range strings.Split(string(out), "\n") {
		switch {
		case strings.HasPrefix(line, "worktree "):
			if current.Path != "" {
				entries = append(entries, current)
			}
			current = WorktreeEntry{Path: strings.TrimPrefix(line, "worktree ")}
		case strings.HasPrefix(line, "HEAD "):
			current.Head = strings.TrimPrefix(line, "HEAD ")
		case strings.HasPrefix(line, "branch "):
			ref := strings.TrimPrefix(line, "branch ")
			current.Branch = strings.TrimPrefix(ref, "refs/heads/")
		case strings.TrimSpace(line) == "bare":
			current.Bare = true
		}
	}
	if current.Path != "" {
		entries = append(entries, current)
	}
	return entries, nil
}

// PruneWorktrees removes stale worktree administrative files for worktrees
// whose directories no longer exist.
func PruneWorktrees(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "prune")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("worktree prune: %w: %s", err, string(out))
	}
	return nil
}
