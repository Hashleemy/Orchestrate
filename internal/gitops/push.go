package gitops

import (
	"fmt"
	"os/exec"
	"strings"
)

// PushResult holds the outcome of a git push operation.
type PushResult struct {
	Branch string `json:"branch"`
	Remote string `json:"remote"`
	Output string `json:"output"`
}

// PushBranch pushes a local branch to origin. It never uses --force.
// The caller is responsible for ensuring the branch has been policy-cleared.
func PushBranch(repoPath, branch string) (*PushResult, error) {
	out, err := exec.Command("git", "-C", repoPath, "push", "origin", branch).CombinedOutput()
	outputStr := strings.TrimSpace(string(out))
	if err != nil {
		return nil, fmt.Errorf("git push origin %s: %w\n%s", branch, err, outputStr)
	}
	return &PushResult{
		Branch: branch,
		Remote: "origin",
		Output: outputStr,
	}, nil
}
