package models

import "time"

type RunStatus string

const (
	RunIdle     RunStatus = "idle"
	RunActive   RunStatus = "active"
	RunPaused   RunStatus = "paused"
	RunStopped  RunStatus = "stopped"
	RunComplete RunStatus = "complete"
)

type Run struct {
	ID              string      `json:"id"`
	Status          RunStatus   `json:"status"`
	RepoPath        string      `json:"repo_path"`
	IntegrationBranch string    `json:"integration_branch"`
	Agents          []Agent     `json:"agents"`
	StartedAt       time.Time   `json:"started_at"`
	StoppedAt       *time.Time  `json:"stopped_at,omitempty"`
}
