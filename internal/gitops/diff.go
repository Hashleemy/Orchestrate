package gitops

import (
	"os/exec"
	"strconv"
	"strings"
)

// FileStat holds per-file diff statistics.
type FileStat struct {
	Path       string `json:"path"`
	Insertions int    `json:"insertions"`
	Deletions  int    `json:"deletions"`
}

// DiffResult summarises a git diff between two refs.
type DiffResult struct {
	Files      []FileStat `json:"files"`
	FileCount  int        `json:"file_count"`
	Insertions int        `json:"insertions"`
	Deletions  int        `json:"deletions"`
}

// FileNames returns the list of files changed between base and head.
func FileNames(repoPath, base, head string) ([]string, error) {
	out, err := exec.Command(
		"git", "-C", repoPath,
		"diff", "--name-only", base+".."+head,
	).Output()
	if err != nil {
		return nil, err
	}
	var files []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line != "" {
			files = append(files, line)
		}
	}
	return files, nil
}

// Stat returns per-file insertion/deletion counts between base and head.
func Stat(repoPath, base, head string) (*DiffResult, error) {
	out, err := exec.Command(
		"git", "-C", repoPath,
		"diff", "--numstat", base+".."+head,
	).Output()
	if err != nil {
		return nil, err
	}

	result := &DiffResult{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}
		ins, _ := strconv.Atoi(parts[0])
		del, _ := strconv.Atoi(parts[1])
		result.Files = append(result.Files, FileStat{
			Path:       parts[2],
			Insertions: ins,
			Deletions:  del,
		})
		result.Insertions += ins
		result.Deletions += del
	}
	result.FileCount = len(result.Files)
	return result, nil
}

// BaseRef returns the best available base ref for diffing: "integration" if
// the branch exists in the repo, otherwise "main".
func BaseRef(repoPath string) string {
	out, _ := exec.Command("git", "-C", repoPath, "branch", "--list", "integration").Output()
	if strings.TrimSpace(string(out)) != "" {
		return "integration"
	}
	return "main"
}
