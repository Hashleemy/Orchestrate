package comms

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ReadAll returns all messages from all agent files in commsDir.
func ReadAll(commsDir string) ([]Message, error) {
	entries, err := os.ReadDir(commsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var messages []Message
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		msgs, err := readFile(filepath.Join(commsDir, e.Name()))
		if err != nil {
			return nil, err
		}
		messages = append(messages, msgs...)
	}
	return messages, nil
}

func readFile(path string) ([]Message, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var messages []Message
	var current *Message
	var bodyLines []string

	scanner := bufio.NewScanner(f)
	inFrontmatter := false

	for scanner.Scan() {
		line := scanner.Text()

		if line == "---" {
			if !inFrontmatter && current == nil {
				inFrontmatter = true
				current = &Message{}
				bodyLines = nil
				continue
			}
			if inFrontmatter {
				inFrontmatter = false
				continue
			}
		}

		if inFrontmatter && current != nil {
			key, val, ok := strings.Cut(line, ": ")
			if !ok {
				continue
			}
			switch key {
			case "timestamp":
				t, _ := time.Parse(time.RFC3339, val)
				current.Timestamp = t
			case "from":
				current.From = val
			case "to":
				current.To = val
			case "type":
				current.Type = MessageType(val)
			case "task":
				current.TaskID = val
			case "priority":
				current.Priority = val
			}
			continue
		}

		if current != nil && !inFrontmatter {
			if line == "" && len(bodyLines) > 0 && bodyLines[len(bodyLines)-1] == "" {
				current.Body = strings.TrimSpace(strings.Join(bodyLines, "\n"))
				messages = append(messages, *current)
				current = nil
				bodyLines = nil
				continue
			}
			bodyLines = append(bodyLines, line)
		}
	}

	if current != nil && len(bodyLines) > 0 {
		current.Body = strings.TrimSpace(strings.Join(bodyLines, "\n"))
		messages = append(messages, *current)
	}

	return messages, scanner.Err()
}
