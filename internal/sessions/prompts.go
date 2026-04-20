package sessions

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"local-agent-orchestrator/internal/models"
)

// WriteTaskFile renders a task into a TASK.md file at the given path.
// The file is what launch-agent.ps1 copies into the worktree as TASK.md.
func WriteTaskFile(destDir string, task models.Task) (string, error) {
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", err
	}
	content := renderTaskFile(task)
	path := filepath.Join(destDir, "TASK-"+task.ID+".md")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("write task file: %w", err)
	}
	return path, nil
}

// RolePromptPath returns the path to the role prompt markdown file.
// Returns an error if the file does not exist.
func RolePromptPath(repoRoot, role string) (string, error) {
	path := filepath.Join(repoRoot, "templates", "roles", role+".md")
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("role prompt not found for %q: %s", role, path)
	}
	return path, nil
}

// PromptContext is the full context passed to an agent at launch.
type PromptContext struct {
	AgentID      string
	Role         string
	TaskID       string
	TaskFilePath string
	RoleFilePath string
}

// BuildPromptContext prepares all prompt files for a launch and returns
// the paths needed by LaunchConfig.
func BuildPromptContext(repoRoot, agentID, role string, task models.Task) (*PromptContext, error) {
	taskDir := filepath.Join(repoRoot, "agent-comms", "tasks")
	taskFile, err := WriteTaskFile(taskDir, task)
	if err != nil {
		return nil, err
	}

	roleFile, err := RolePromptPath(repoRoot, role)
	if err != nil {
		// Non-fatal: fall back to coordinator role if the specific role is missing.
		roleFile, _ = RolePromptPath(repoRoot, "coordinator")
	}

	return &PromptContext{
		AgentID:      agentID,
		Role:         role,
		TaskID:       task.ID,
		TaskFilePath: taskFile,
		RoleFilePath: roleFile,
	}, nil
}

func renderTaskFile(t models.Task) string {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("# %s\n\n", t.ID))
	b.WriteString(fmt.Sprintf("## %s\n\n", t.Title))
	b.WriteString("## Metadata\n\n```\n")
	b.WriteString(fmt.Sprintf("status:       %s\n", t.Status))
	b.WriteString(fmt.Sprintf("priority:     %s\n", t.Priority))
	b.WriteString(fmt.Sprintf("type:         %s\n", t.Type))
	b.WriteString(fmt.Sprintf("title:        %s\n", t.Title))
	b.WriteString(fmt.Sprintf("owner:        %s\n", t.Owner))
	b.WriteString(fmt.Sprintf("branch:       %s\n", t.Branch))
	b.WriteString(fmt.Sprintf("worktree:     %s\n", t.Worktree))
	b.WriteString(fmt.Sprintf("depends_on:   [%s]\n", strings.Join(t.DependsOn, ", ")))
	b.WriteString(fmt.Sprintf("risk:         %s\n", t.Risk))
	majorStr := "no"
	if t.MajorChange {
		majorStr = "yes"
	}
	b.WriteString(fmt.Sprintf("major_change: %s\n", majorStr))
	b.WriteString("```\n\n")

	if len(t.Files) > 0 {
		b.WriteString("## Scope\n\n```\nfiles:\n")
		for _, f := range t.Files {
			b.WriteString(fmt.Sprintf("  - %s\n", f))
		}
		b.WriteString("```\n\n")
	}

	if len(t.Acceptance) > 0 {
		b.WriteString("## Acceptance Criteria\n\n```\nacceptance:\n")
		for _, a := range t.Acceptance {
			b.WriteString(fmt.Sprintf("  - %s\n", a))
		}
		b.WriteString("```\n\n")
	}

	if len(t.Notes) > 0 {
		b.WriteString("## Notes\n\n```\nnotes:\n")
		for _, n := range t.Notes {
			b.WriteString(fmt.Sprintf("  - %s\n", n))
		}
		b.WriteString("```\n\n")
	}

	b.WriteString("## Completion Checklist\n\n")
	b.WriteString("- [ ] All acceptance criteria met\n")
	b.WriteString("- [ ] Build and tests pass\n")
	b.WriteString("- [ ] Changes committed with clear messages\n")
	b.WriteString(fmt.Sprintf("- [ ] Final heartbeat written with `state: complete` at %s\n",
		time.Now().UTC().Format(time.RFC3339)))
	b.WriteString("- [ ] `completed` event emitted\n")
	b.WriteString(fmt.Sprintf("- [ ] Message sent to coordinator: \"%s complete: <one-line summary>\"\n", t.ID))

	return b.String()
}
