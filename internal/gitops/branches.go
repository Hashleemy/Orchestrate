package gitops

import (
	"fmt"
	"os/exec"
	"strings"
)

func BranchExists(repoPath, branch string) bool {
	out, err := exec.Command("git", "-C", repoPath, "branch", "--list", branch).Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) != ""
}

func CreateBranch(repoPath, branch, baseRef string) error {
	cmd := exec.Command("git", "-C", repoPath, "branch", branch, baseRef)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("create branch %q: %w: %s", branch, err, string(out))
	}
	return nil
}

func DeleteBranch(repoPath, branch string) error {
	cmd := exec.Command("git", "-C", repoPath, "branch", "-d", branch)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("delete branch %q: %w: %s", branch, err, string(out))
	}
	return nil
}

func ForceDeleteBranch(repoPath, branch string) error {
	cmd := exec.Command("git", "-C", repoPath, "branch", "-D", branch)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("force-delete branch %q: %w: %s", branch, err, string(out))
	}
	return nil
}

func ListBranches(repoPath string) ([]string, error) {
	out, err := exec.Command("git", "-C", repoPath, "branch", "--format=%(refname:short)").Output()
	if err != nil {
		return nil, fmt.Errorf("list branches: %w", err)
	}
	var branches []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line != "" {
			branches = append(branches, line)
		}
	}
	return branches, nil
}

func ListAgentBranches(repoPath string) ([]string, error) {
	out, err := exec.Command(
		"git", "-C", repoPath,
		"branch", "--format=%(refname:short)", "--list", "agent/*",
	).Output()
	if err != nil {
		return nil, fmt.Errorf("list agent branches: %w", err)
	}
	var branches []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line != "" {
			branches = append(branches, line)
		}
	}
	return branches, nil
}
