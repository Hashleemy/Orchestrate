package tasks

import (
	"fmt"
	"strings"

	"local-agent-orchestrator/internal/models"
)

// SerializeTasks writes a minimal but valid tasks.md from a slice of tasks and
// an optional list of global rules. Use this when you have an updated task list
// but no full TaskList struct (e.g. after in-place mutations in the coordinator).
func SerializeTasks(rules []string, tasks []models.Task) string {
	tl := &TaskList{GlobalRules: rules, Tasks: tasks}
	return Serialize(tl)
}

func Serialize(list *TaskList) string {
	var sb strings.Builder

	sb.WriteString("# Tasks\n\n")
	sb.WriteString("## Global Rules\n")
	for _, rule := range list.GlobalRules {
		sb.WriteString("- " + rule + "\n")
	}
	sb.WriteString("\n## Status Values\n")
	for _, s := range []string{"todo", "ready", "in_progress", "blocked", "awaiting_review", "awaiting_approval", "done", "cancelled"} {
		sb.WriteString("- " + s + "\n")
	}
	sb.WriteString("\n## Active Tasks\n")
	for _, t := range list.Tasks {
		sb.WriteString(serializeTask(t))
	}
	return sb.String()
}

func serializeTask(t models.Task) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("\n### %s\n", t.ID))
	sb.WriteString(fmt.Sprintf("status: %s\n", t.Status))
	sb.WriteString(fmt.Sprintf("priority: %s\n", t.Priority))
	sb.WriteString(fmt.Sprintf("type: %s\n", t.Type))
	sb.WriteString(fmt.Sprintf("title: %s\n", t.Title))
	sb.WriteString(fmt.Sprintf("owner: %s\n", t.Owner))
	sb.WriteString(fmt.Sprintf("branch: %s\n", t.Branch))
	sb.WriteString(fmt.Sprintf("worktree: %s\n", t.Worktree))
	sb.WriteString(fmt.Sprintf("depends_on: [%s]\n", strings.Join(t.DependsOn, ", ")))
	sb.WriteString(fmt.Sprintf("blocked_by: [%s]\n", strings.Join(t.BlockedBy, ", ")))
	sb.WriteString("files:\n")
	for _, f := range t.Files {
		sb.WriteString("  - " + f + "\n")
	}
	sb.WriteString("acceptance:\n")
	for _, a := range t.Acceptance {
		sb.WriteString("  - " + a + "\n")
	}
	sb.WriteString(fmt.Sprintf("risk: %s\n", t.Risk))
	mc := "no"
	if t.MajorChange {
		mc = "yes"
	}
	sb.WriteString(fmt.Sprintf("major_change: %s\n", mc))
	if len(t.Notes) > 0 {
		sb.WriteString("notes:\n")
		for _, n := range t.Notes {
			sb.WriteString("  - " + n + "\n")
		}
	}
	return sb.String()
}
