package parser

import (
	"bufio"
	"fmt"
	"strings"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/tasks"
)

// Parse reads a tasks.md string and returns a TaskList.
func Parse(content string) (*tasks.TaskList, error) {
	content = strings.TrimPrefix(content, "\xEF\xBB\xBF") // strip UTF-8 BOM if present
	list := &tasks.TaskList{}
	scanner := bufio.NewScanner(strings.NewReader(content))

	var current *models.Task
	var inGlobalRules bool
	var inFiles, inAcceptance, inNotes bool

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if trimmed == "## Global Rules" {
			inGlobalRules = true
			current = nil
			continue
		}
		if strings.HasPrefix(trimmed, "## ") {
			inGlobalRules = false
			current = nil
			continue
		}

		if inGlobalRules {
			if strings.HasPrefix(trimmed, "- ") {
				list.GlobalRules = append(list.GlobalRules, strings.TrimPrefix(trimmed, "- "))
			}
			continue
		}

		if strings.HasPrefix(trimmed, "### TASK-") {
			if current != nil {
				list.Tasks = append(list.Tasks, *current)
			}
			current = &models.Task{ID: strings.TrimPrefix(trimmed, "### ")}
			inFiles, inAcceptance, inNotes = false, false, false
			continue
		}

		if current == nil {
			continue
		}

		// multiline list fields
		if trimmed == "files:" {
			inFiles, inAcceptance, inNotes = true, false, false
			continue
		}
		if trimmed == "acceptance:" {
			inFiles, inAcceptance, inNotes = false, true, false
			continue
		}
		if trimmed == "notes:" {
			inFiles, inAcceptance, inNotes = false, false, true
			continue
		}

		if strings.HasPrefix(line, "  - ") {
			item := strings.TrimPrefix(line, "  - ")
			switch {
			case inFiles:
				current.Files = append(current.Files, item)
			case inAcceptance:
				current.Acceptance = append(current.Acceptance, item)
			case inNotes:
				current.Notes = append(current.Notes, item)
			}
			continue
		}

		// single-value fields reset list mode
		inFiles, inAcceptance, inNotes = false, false, false

		key, val, ok := strings.Cut(trimmed, ": ")
		if !ok {
			continue
		}
		if err := applyField(current, key, val); err != nil {
			return nil, fmt.Errorf("task %s field %q: %w", current.ID, key, err)
		}
	}

	if current != nil {
		list.Tasks = append(list.Tasks, *current)
	}

	return list, scanner.Err()
}

func applyField(t *models.Task, key, val string) error {
	val = strings.TrimSpace(val)
	switch key {
	case "status":
		t.Status = models.TaskStatus(val)
	case "priority":
		t.Priority = val
	case "type":
		t.Type = val
	case "title":
		t.Title = val
	case "owner":
		t.Owner = val
	case "branch":
		t.Branch = val
	case "worktree":
		t.Worktree = val
	case "depends_on":
		t.DependsOn = parseInlineList(val)
	case "blocked_by":
		t.BlockedBy = parseInlineList(val)
	case "risk":
		t.Risk = val
	case "major_change":
		t.MajorChange = val == "yes"
	}
	return nil
}

func parseInlineList(s string) []string {
	s = strings.Trim(s, "[]")
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
