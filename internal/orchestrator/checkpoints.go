package orchestrator

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type CheckpointKind string

const (
	CheckpointPackageInstall  CheckpointKind = "package_install"
	CheckpointLockfileChange  CheckpointKind = "lockfile_change"
	CheckpointMergeConflict   CheckpointKind = "merge_conflict"
	CheckpointProtectedMerge  CheckpointKind = "protected_merge"
	CheckpointMajorChange     CheckpointKind = "major_change"
	CheckpointSensitiveFile   CheckpointKind = "sensitive_file"
	CheckpointArchBlock       CheckpointKind = "architectural_block"
	CheckpointMilestone       CheckpointKind = "milestone"
)

type CheckpointStatus string

const (
	CheckpointPending  CheckpointStatus = "pending"
	CheckpointResolved CheckpointStatus = "resolved"
)

type Checkpoint struct {
	ID         string           `json:"id"`
	Kind       CheckpointKind   `json:"kind"`
	Detail     string           `json:"detail"`
	NextSteps  []string         `json:"next_steps"`
	Status     CheckpointStatus `json:"status"`
	Choice     string           `json:"choice,omitempty"`
	CreatedAt  string           `json:"created_at"`
	ResolvedAt string           `json:"resolved_at,omitempty"`
}

func (o *Orchestrator) checkpointsDir() string {
	return filepath.Join(o.cfg.CommsDir, "checkpoints")
}

// RaiseCheckpoint writes a new pending checkpoint file and returns it.
// The orchestration layer should halt further progress until this is resolved.
func (o *Orchestrator) RaiseCheckpoint(kind, detail string, nextSteps []string) (*Checkpoint, error) {
	if err := os.MkdirAll(o.checkpointsDir(), 0755); err != nil {
		return nil, err
	}

	id, err := newID()
	if err != nil {
		return nil, err
	}

	cp := &Checkpoint{
		ID:        id,
		Kind:      CheckpointKind(kind),
		Detail:    detail,
		NextSteps: nextSteps,
		Status:    CheckpointPending,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := o.writeCheckpoint(cp); err != nil {
		return nil, err
	}
	return cp, nil
}

// ActiveCheckpoints returns all checkpoints that are still pending.
func (o *Orchestrator) ActiveCheckpoints() ([]*Checkpoint, error) {
	entries, err := os.ReadDir(o.checkpointsDir())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []*Checkpoint
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		cp, err := o.readCheckpoint(filepath.Join(o.checkpointsDir(), e.Name()))
		if err != nil {
			continue
		}
		if cp.Status == CheckpointPending {
			out = append(out, cp)
		}
	}
	return out, nil
}

// AllCheckpoints returns every checkpoint regardless of status.
func (o *Orchestrator) AllCheckpoints() ([]*Checkpoint, error) {
	entries, err := os.ReadDir(o.checkpointsDir())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var out []*Checkpoint
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		cp, err := o.readCheckpoint(filepath.Join(o.checkpointsDir(), e.Name()))
		if err != nil {
			continue
		}
		out = append(out, cp)
	}
	return out, nil
}

// ResolveCheckpoint marks a checkpoint resolved with the user's chosen next step.
func (o *Orchestrator) ResolveCheckpoint(id, choice string) error {
	entries, err := os.ReadDir(o.checkpointsDir())
	if err != nil {
		return err
	}

	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		path := filepath.Join(o.checkpointsDir(), e.Name())
		cp, err := o.readCheckpoint(path)
		if err != nil {
			continue
		}
		if cp.ID != id {
			continue
		}
		cp.Status = CheckpointResolved
		cp.Choice = choice
		cp.ResolvedAt = time.Now().UTC().Format(time.RFC3339)
		return o.writeCheckpoint(cp)
	}
	return fmt.Errorf("checkpoint not found: %s", id)
}

// HasPendingCheckpoints returns true if any checkpoint is awaiting user input.
func (o *Orchestrator) HasPendingCheckpoints() (bool, error) {
	active, err := o.ActiveCheckpoints()
	return len(active) > 0, err
}

func (o *Orchestrator) writeCheckpoint(cp *Checkpoint) error {
	data, err := json.MarshalIndent(cp, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(o.checkpointsDir(), cp.ID+".json")
	return os.WriteFile(path, data, 0644)
}

func (o *Orchestrator) readCheckpoint(path string) (*Checkpoint, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cp Checkpoint
	if err := json.Unmarshal(data, &cp); err != nil {
		return nil, err
	}
	return &cp, nil
}

// GuardPendingCheckpoints returns an error if any checkpoint is still pending,
// blocking the caller from proceeding with the named operation. Call this at
// the start of any orchestration action that must not run past a checkpoint.
func (o *Orchestrator) GuardPendingCheckpoints(op string) error {
	active, err := o.ActiveCheckpoints()
	if err != nil {
		return fmt.Errorf("checkpoint guard: %w", err)
	}
	if len(active) == 0 {
		return nil
	}
	ids := make([]string, len(active))
	for i, cp := range active {
		ids[i] = cp.ID
	}
	return fmt.Errorf("%s blocked: %d pending checkpoint(s) must be resolved first: %v", op, len(active), ids)
}

// RaiseFromTriggers inspects a slice of policy checkpoint triggers and raises
// a checkpoint for the first blocking one found. Returns nil if no raise needed.
func (o *Orchestrator) RaiseFromTriggers(triggers []string, detail string) (*Checkpoint, error) {
	if len(triggers) == 0 {
		return nil, nil
	}
	kind := triggers[0]
	nextSteps := defaultNextSteps(CheckpointKind(kind))
	return o.RaiseCheckpoint(kind, detail, nextSteps)
}

func defaultNextSteps(kind CheckpointKind) []string {
	switch kind {
	case CheckpointPackageInstall:
		return []string{"Approve the package install via the approval queue", "Deny and ask the agent to find an alternative"}
	case CheckpointLockfileChange:
		return []string{"Review the lockfile diff and approve", "Deny and roll back the dependency change"}
	case CheckpointMergeConflict:
		return []string{"Resolve conflicts manually then retry the merge", "Abort the merge and reassign the task"}
	case CheckpointProtectedMerge:
		return []string{"Review the diff and approve the merge to the protected branch", "Deny the merge and request further review"}
	case CheckpointMajorChange:
		return []string{"Review the diff summary and approve", "Request the agent reduce scope before merging"}
	case CheckpointSensitiveFile:
		return []string{"Remove the sensitive file from the diff and retry", "Abort the operation"}
	case CheckpointArchBlock:
		return []string{"Clarify the architectural decision and unblock the agent", "Reassign the task with updated acceptance criteria"}
	case CheckpointMilestone:
		return []string{"Continue with the next phase", "Review completed work before proceeding", "Stop the run"}
	default:
		return []string{"Review the situation and choose a next step", "Stop the run"}
	}
}

func newID() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
