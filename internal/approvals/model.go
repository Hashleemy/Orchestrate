package approvals

import (
	"time"

	"local-agent-orchestrator/internal/policy"
)

type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalDenied   ApprovalStatus = "denied"
)

type Approval struct {
	ID        string                  `json:"id"`
	Trigger   policy.CheckpointTrigger `json:"trigger"`
	AgentName string                  `json:"agent_name"`
	TaskID    string                  `json:"task_id"`
	Detail    string                  `json:"detail"`
	Status    ApprovalStatus          `json:"status"`
	CreatedAt time.Time               `json:"created_at"`
	ResolvedAt *time.Time             `json:"resolved_at,omitempty"`
}
