package comms

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Append writes a message block to the agent-comms directory.
// Each agent gets its own file; messages are append-only.
func Append(commsDir string, msg Message) error {
	if err := os.MkdirAll(commsDir, 0755); err != nil {
		return fmt.Errorf("comms mkdir: %w", err)
	}

	filename := filepath.Join(commsDir, msg.From+".md")
	f, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open comms file: %w", err)
	}
	defer f.Close()

	ts := msg.Timestamp
	if ts.IsZero() {
		ts = time.Now()
	}

	block := fmt.Sprintf("---\ntimestamp: %s\nfrom: %s\nto: %s\ntype: %s\ntask: %s\npriority: %s\n---\n\n%s\n\n",
		ts.Format(time.RFC3339),
		msg.From,
		msg.To,
		msg.Type,
		msg.TaskID,
		msg.Priority,
		msg.Body,
	)
	_, err = f.WriteString(block)
	return err
}
