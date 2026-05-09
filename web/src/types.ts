export interface AgentStatus {
  agent: string
  task_id: string
  state: 'idle' | 'planning' | 'coding' | 'testing' | 'blocked' | 'awaiting_approval' | 'complete' | 'stopped'
  cwd: string
  branch: string
  last_action: string
  timestamp: string
  pid?: number
  stale?: boolean
  alive?: boolean
}

export interface OrchestratorEvent {
  timestamp: string
  agent: string
  task_id: string
  type:
    | 'task_started'
    | 'task_claimed'
    | 'task_promoted'
    | 'file_edit'
    | 'test_run'
    | 'test_pass'
    | 'test_fail'
    | 'commit'
    | 'push'
    | 'merged'
    | 'blocked'
    | 'unblocked'
    | 'approval_requested'
    | 'approval_received'
    | 'approval_denied'
    | 'message_sent'
    | 'message_received'
    | 'review_requested'
    | 'review_complete'
    | 'checkpoint_raised'
    | 'checkpoint_resolved'
    | 'completed'
    | 'error'
  detail: string
}

export interface Approval {
  id: string
  trigger: string
  agent: string
  task_id: string
  detail: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  resolved_at: string | null
}

export interface Task {
  id: string
  status: string
  title: string
  owner: string
  priority: string
  risk: string
  branch: string
  depends_on: string[] | null
  blocked_by: string[] | null
}

export interface DiffSummary {
  agent_id: string
  branch: string
  base_ref: string
  kind: 'minor' | 'major' | 'blocked'
  triggers: string[]
  reasons: string[]
  files: string[]
  file_count: number
  insertions: number
  deletions: number
}

export interface RepoStatus {
  ok: boolean
  service: string
  repo_path: string
  branch: string
  clean: boolean
}

export interface Checkpoint {
  id: string
  kind: string
  detail: string
  next_steps: string[] | null
  status: 'pending' | 'resolved'
  choice?: string
  created_at: string
  resolved_at?: string
}

export interface RunSummary {
  done:                Task[]
  in_progress:         Task[]
  blocked:             Task[]
  ready:               Task[]
  pending:             Task[]
  pending_approvals:   Approval[]
  pending_checkpoints: Checkpoint[]
  next_steps:          string[]
}

export interface ReviewRequest {
  reviewer_id: string
  worker_id: string
  task_id: string
  branch: string
  base_ref: string
  requested_at: string
  status: 'pending' | 'complete'
}

export interface ReviewVerdict {
  reviewer_id: string
  worker_id: string
  task_id: string
  branch: string
  verdict: 'approve' | 'revise'
  issues: string[] | null
  risk: 'low' | 'medium' | 'high'
  merge_recommendation: 'ready' | 'needs-changes' | 'escalate-to-user'
  reviewed_at: string
}

export interface ReviewsPayload {
  verdicts: ReviewVerdict[]
  requests: ReviewRequest[]
}

export interface RunRecord {
  id: string
  started_at: string
  ended_at: string
  duration_sec: number
  status: 'idle' | 'active' | 'paused' | 'stopped' | 'complete'
  repo_path: string
  workers: string[]
  tasks_done: number
  tasks_total: number
  done_ids: string[]
  event_count: number
  summary: string
}

export interface AgentMergeResult {
  agent_id: string
  branch: string
  into_branch: string
  status: 'merged' | 'conflicts' | 'error'
  conflicts: boolean
  output?: string
}

export interface AgentPushResult {
  agent_id: string
  branch: string
  status: 'pushed' | 'approval_required' | 'blocked' | 'error'
  decision?: {
    allowed: boolean
    requires_approval: boolean
    blocked: boolean
    kind: 'minor' | 'major' | 'blocked'
    reasons: string[]
  }
  checkpoint_id?: string
  output?: string
}

export interface HealthInfo {
  ok:           boolean
  version:      string
  go_version:   string
  started_at:   string
  uptime_sec:   number
  agents_alive: number
}

export interface AgentMessage {
  timestamp: string
  from: string
  to: string
  type: 'question' | 'answer' | 'broadcast' | 'status' | 'block'
  task_id: string
  priority: string
  body: string
}
