package orchestrator

import (
	"fmt"
	"strings"

	"local-agent-orchestrator/internal/models"
)

// RunSummary is a point-in-time snapshot of the orchestration run state.
type RunSummary struct {
	Done        []models.Task  `json:"done"`
	InProgress  []models.Task  `json:"in_progress"`
	Blocked     []models.Task  `json:"blocked"`
	Ready       []models.Task  `json:"ready"`
	Pending     []models.Task  `json:"pending"`
	Approvals   []*FileApproval  `json:"pending_approvals"`
	Checkpoints []*Checkpoint  `json:"pending_checkpoints"`
	NextSteps   []string       `json:"next_steps"`
}

// BuildSummary aggregates the current run state into a RunSummary.
func (o *Orchestrator) BuildSummary() (*RunSummary, error) {
	tasks, err := o.Tasks()
	if err != nil {
		return nil, fmt.Errorf("build summary: %w", err)
	}

	s := &RunSummary{}
	for _, t := range tasks {
		switch t.Status {
		case models.TaskDone:
			s.Done = append(s.Done, t)
		case models.TaskInProgress:
			s.InProgress = append(s.InProgress, t)
		case models.TaskBlocked:
			s.Blocked = append(s.Blocked, t)
		case models.TaskReady:
			s.Ready = append(s.Ready, t)
		case models.TaskAwaitingApproval, models.TaskAwaitingReview:
			s.Pending = append(s.Pending, t)
		}
	}

	s.Approvals, _ = o.FileApprovals()
	s.Checkpoints, _ = o.ActiveCheckpoints()
	s.NextSteps = deriveNextSteps(s)

	return s, nil
}

// FormatSummary returns a human-readable text version of a RunSummary,
// suitable for displaying at a checkpoint or end-of-run prompt.
func FormatSummary(s *RunSummary) string {
	var b strings.Builder

	b.WriteString("## Run Summary\n\n")

	b.WriteString(fmt.Sprintf("**Done (%d):**\n", len(s.Done)))
	for _, t := range s.Done {
		b.WriteString(fmt.Sprintf("  - [%s] %s\n", t.ID, t.Title))
	}

	b.WriteString(fmt.Sprintf("\n**In Progress (%d):**\n", len(s.InProgress)))
	for _, t := range s.InProgress {
		b.WriteString(fmt.Sprintf("  - [%s] %s — owner: %s\n", t.ID, t.Title, t.Owner))
	}

	if len(s.Blocked) > 0 {
		b.WriteString(fmt.Sprintf("\n**Blocked (%d):**\n", len(s.Blocked)))
		for _, t := range s.Blocked {
			b.WriteString(fmt.Sprintf("  - [%s] %s\n", t.ID, t.Title))
		}
	}

	if len(s.Approvals) > 0 {
		b.WriteString(fmt.Sprintf("\n**Pending Approvals (%d):**\n", len(s.Approvals)))
		for _, a := range s.Approvals {
			if a.Status == "pending" {
				b.WriteString(fmt.Sprintf("  - [%s] %s — %s\n", a.ID, a.Trigger, a.Detail))
			}
		}
	}

	if len(s.Checkpoints) > 0 {
		b.WriteString(fmt.Sprintf("\n**Checkpoints Requiring Attention (%d):**\n", len(s.Checkpoints)))
		for _, cp := range s.Checkpoints {
			b.WriteString(fmt.Sprintf("  - [%s] %s — %s\n", cp.ID, cp.Kind, cp.Detail))
		}
	}

	if len(s.NextSteps) > 0 {
		b.WriteString("\n**Recommended Next Steps:**\n")
		for i, step := range s.NextSteps {
			b.WriteString(fmt.Sprintf("  %d. %s\n", i+1, step))
		}
	}

	return b.String()
}

func deriveNextSteps(s *RunSummary) []string {
	var steps []string

	if len(s.Checkpoints) > 0 {
		steps = append(steps, fmt.Sprintf("Resolve %d pending checkpoint(s) before continuing", len(s.Checkpoints)))
	}

	if len(s.Approvals) > 0 {
		pending := 0
		for _, a := range s.Approvals {
			if a.Status == "pending" {
				pending++
			}
		}
		if pending > 0 {
			steps = append(steps, fmt.Sprintf("Approve or deny %d pending operation(s) in the approval queue", pending))
		}
	}

	if len(s.Blocked) > 0 {
		steps = append(steps, fmt.Sprintf("Investigate %d blocked task(s) and unblock or reassign", len(s.Blocked)))
	}

	if len(s.Ready) > 0 && len(s.InProgress) == 0 {
		steps = append(steps, fmt.Sprintf("Assign %d ready task(s) to available agents", len(s.Ready)))
	}

	if len(s.InProgress) > 0 {
		steps = append(steps, fmt.Sprintf("Wait for %d in-progress task(s) to complete, then review diffs before merging", len(s.InProgress)))
	}

	if len(s.Done) > 0 && len(s.InProgress) == 0 && len(s.Ready) == 0 && len(s.Blocked) == 0 {
		steps = append(steps, "All active tasks complete — review merged changes and plan the next phase")
	}

	if len(steps) == 0 {
		steps = append(steps, "No active tasks — load a tasks.md file and start a new run")
	}

	return steps
}
