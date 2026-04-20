package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"local-agent-orchestrator/internal/models"
)

// RunRecord is the persisted metadata for a completed orchestration run.
type RunRecord struct {
	ID          string           `json:"id"`
	StartedAt   time.Time        `json:"started_at"`
	EndedAt     time.Time        `json:"ended_at"`
	DurationSec float64          `json:"duration_sec"`
	Status      models.RunStatus `json:"status"`
	RepoPath    string           `json:"repo_path"`
	Workers     []string         `json:"workers"`
	TasksDone   int              `json:"tasks_done"`
	TasksTotal  int              `json:"tasks_total"`
	DoneIDs     []string         `json:"done_ids"`
	EventCount  int              `json:"event_count"`
	Summary     string           `json:"summary"`
}

// RunHistory persists and retrieves RunRecords from the agent-comms/runs/ directory.
type RunHistory struct {
	dir string
}

func newRunHistory(commsDir string) *RunHistory {
	return NewRunHistory(commsDir)
}

// NewRunHistory creates a RunHistory backed by <commsDir>/runs/.
// Exported for use in tests.
func NewRunHistory(commsDir string) *RunHistory {
	dir := filepath.Join(commsDir, "runs")
	_ = os.MkdirAll(dir, 0755)
	return &RunHistory{dir: dir}
}

func (h *RunHistory) record(rec *RunRecord) error {
	return h.Record(rec)
}

// Record persists a RunRecord to disk.
func (h *RunHistory) Record(rec *RunRecord) error {
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(h.dir, rec.ID+".json"), data, 0644)
}

// List returns all run records, newest first.
func (h *RunHistory) List() ([]*RunRecord, error) {
	entries, err := os.ReadDir(h.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []*RunRecord
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(h.dir, e.Name()))
		if err != nil {
			continue
		}
		var rec RunRecord
		if err := json.Unmarshal(data, &rec); err != nil {
			continue
		}
		out = append(out, &rec)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].StartedAt.After(out[j].StartedAt)
	})
	return out, nil
}

// Get retrieves a single run record by ID.
func (h *RunHistory) Get(id string) (*RunRecord, error) {
	data, err := os.ReadFile(filepath.Join(h.dir, id+".json"))
	if err != nil {
		return nil, fmt.Errorf("run not found: %s", id)
	}
	var rec RunRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}
