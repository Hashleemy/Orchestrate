package gitops

import (
	"fmt"
	"os/exec"
	"strings"
)

type MergeResult struct {
	FromBranch string `json:"from_branch"`
	IntoBranch string `json:"into_branch"`
	Conflicts  bool   `json:"conflicts"`
	Output     string `json:"output"`
}

// DryRunMerge checks whether merging from into into would produce conflicts
// without actually committing the merge.
func DryRunMerge(repoPath, from, into string) (bool, error) {
	// Switch to the target branch's tree without touching HEAD via merge-tree.
	intoRef, err := exec.Command("git", "-C", repoPath, "rev-parse", into).Output()
	if err != nil {
		return false, fmt.Errorf("resolve %q: %w", into, err)
	}
	fromRef, err := exec.Command("git", "-C", repoPath, "rev-parse", from).Output()
	if err != nil {
		return false, fmt.Errorf("resolve %q: %w", from, err)
	}
	baseOut, err := exec.Command(
		"git", "-C", repoPath,
		"merge-base", strings.TrimSpace(string(intoRef)), strings.TrimSpace(string(fromRef)),
	).Output()
	if err != nil {
		return false, fmt.Errorf("merge-base: %w", err)
	}
	base := strings.TrimSpace(string(baseOut))

	out, _ := exec.Command(
		"git", "-C", repoPath,
		"merge-tree", base, strings.TrimSpace(string(intoRef)), strings.TrimSpace(string(fromRef)),
	).Output()

	// merge-tree prints conflict markers when conflicts exist.
	return strings.Contains(string(out), "<<<<<<"), nil
}

// MergeBranch merges from into the currently checked-out branch (which must be
// into). The caller is responsible for checking out the correct branch first.
func MergeBranch(repoPath, from, into string) (*MergeResult, error) {
	result := &MergeResult{FromBranch: from, IntoBranch: into}

	// Ensure we are on the target branch.
	current, err := CurrentBranch(repoPath)
	if err != nil {
		return nil, err
	}
	if current != into {
		return nil, fmt.Errorf("expected branch %q, currently on %q", into, current)
	}

	cmd := exec.Command("git", "-C", repoPath, "merge", "--no-ff", from, "-m",
		fmt.Sprintf("merge %s into %s", from, into))
	out, err := cmd.CombinedOutput()
	result.Output = string(out)
	if err != nil {
		if strings.Contains(result.Output, "CONFLICT") {
			result.Conflicts = true
			return result, fmt.Errorf("merge conflict: %s", result.Output)
		}
		return result, fmt.Errorf("merge failed: %w: %s", err, result.Output)
	}
	return result, nil
}

// AbortMerge aborts an in-progress conflicted merge.
func AbortMerge(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "merge", "--abort")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("merge abort: %w: %s", err, string(out))
	}
	return nil
}

// Checkout switches the repo to the given branch.
func Checkout(repoPath, branch string) error {
	cmd := exec.Command("git", "-C", repoPath, "checkout", branch)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("checkout %q: %w: %s", branch, err, string(out))
	}
	return nil
}
