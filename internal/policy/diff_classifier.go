package policy

import (
	"path/filepath"
	"strings"

	"local-agent-orchestrator/internal/models"
)

// DiffKind is the severity classification of a set of changed files.
type DiffKind string

const (
	DiffMinor   DiffKind = "minor"
	DiffMajor   DiffKind = "major"
	DiffBlocked DiffKind = "blocked"
)

// DiffClassification is the result of classifying a set of changed files.
type DiffClassification struct {
	Kind     DiffKind            `json:"kind"`
	Triggers []CheckpointTrigger `json:"triggers"`
	Reasons  []string            `json:"reasons"`
}

// majorFilePatterns are base-name patterns (filepath.Match) that indicate a
// major change regardless of file content.
var majorFilePatterns = []string{
	"*.sql",
	"Dockerfile",
	"docker-compose.yml",
	"docker-compose.yaml",
	"go.mod",
	"pyproject.toml",
	"Cargo.toml",
	"build.gradle",
	"pom.xml",
}

// majorPathPrefixes are path prefixes that indicate CI/CD or infrastructure.
var majorPathPrefixes = []string{
	".github/",
	".gitlab/",
	"infra/",
	"terraform/",
	"k8s/",
	"deploy/",
}

// majorNameKeywords in the filename (case-insensitive) suggest sensitive logic.
var majorNameKeywords = []string{
	"auth",
	"login",
	"schema",
	"migration",
	"credential",
	"permission",
	"rbac",
}

// largeChangeThreshold: more than this many files in one diff is treated as major.
const largeChangeThreshold = 20

// ClassifyFiles classifies a list of changed file paths. If task is non-nil,
// its risk and major_change fields are also considered.
func ClassifyFiles(files []string, task *models.Task) *DiffClassification {
	c := &DiffClassification{Kind: DiffMinor}
	seen := make(map[CheckpointTrigger]bool)

	add := func(trigger CheckpointTrigger, reason string) {
		if !seen[trigger] {
			seen[trigger] = true
			c.Triggers = append(c.Triggers, trigger)
		}
		c.Reasons = append(c.Reasons, reason)
	}

	// Task-level signals
	if task != nil && (task.MajorChange || task.Risk == "high") {
		add(TriggerMajorChange, "task is flagged major_change or risk: high")
		c.Kind = DiffMajor
	}

	for _, path := range files {
		base := filepath.Base(path)
		lower := strings.ToLower(path)

		// Protected file → blocked immediately
		if IsProtectedPath(path) {
			add(TriggerSensitiveFile, "protected file: "+path)
			c.Kind = DiffBlocked
			continue
		}

		// Lockfile
		if IsLockfile(base) {
			add(TriggerLockfileChange, "lockfile: "+path)
			if c.Kind != DiffBlocked {
				c.Kind = DiffMajor
			}
			continue
		}

		// Major filename patterns
		for _, pat := range majorFilePatterns {
			if matched, _ := filepath.Match(pat, base); matched {
				add(TriggerMajorChange, "build/config file: "+path)
				if c.Kind == DiffMinor {
					c.Kind = DiffMajor
				}
				break
			}
		}

		// Major path prefixes (CI, infra)
		for _, prefix := range majorPathPrefixes {
			if strings.HasPrefix(lower, prefix) {
				add(TriggerMajorChange, "infrastructure path: "+path)
				if c.Kind == DiffMinor {
					c.Kind = DiffMajor
				}
				break
			}
		}

		// Sensitive name keywords
		for _, kw := range majorNameKeywords {
			if strings.Contains(lower, kw) {
				add(TriggerMajorChange, "sensitive keyword '"+kw+"' in: "+path)
				if c.Kind == DiffMinor {
					c.Kind = DiffMajor
				}
				break
			}
		}
	}

	// Breadth heuristic: large diffs are always major
	if len(files) > largeChangeThreshold && c.Kind == DiffMinor {
		add(TriggerMajorChange, "large diff: "+itoa(len(files))+" files changed")
		c.Kind = DiffMajor
	}

	return c
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
