import type { AgentMergeResult, AgentMessage, AgentPushResult, AgentStatus, Approval, Checkpoint, DiffSummary, OrchestratorEvent, RepoStatus, ReviewsPayload, RunRecord, RunSummary, Task } from '../types'

const base = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json() as Promise<T>
}

async function post(path: string, body?: unknown): Promise<void> {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

export const api = {
  status:      () => get<RepoStatus>('/status'),
  agents:      () => get<AgentStatus[]>('/agents'),
  events:      () => get<OrchestratorEvent[]>('/events'),
  approvals:   () => get<Approval[]>('/approvals'),
  tasks:       () => get<Task[]>('/tasks'),
  messages:    () => get<AgentMessage[]>('/messages'),
  checkpoints: () => get<Checkpoint[]>('/checkpoints'),
  summary:     () => get<RunSummary>('/summary'),
  agentDiff:   (id: string) => get<DiffSummary>(`/agents/${encodeURIComponent(id)}/diff`),
  approve:     (id: string) => post(`/approvals/${id}/approve`),
  deny:        (id: string) => post(`/approvals/${id}/deny`),
  resolveCheckpoint: (id: string, choice: string) => post(`/checkpoints/${id}/resolve`, { choice }),
  openRepo:    (path: string) => postJSON<{ path: string; branch: string; clean: boolean }>('/repo/open', { path }),
  pickRepo:    () => postJSON<{ path: string }>('/repo/pick'),
  startRun:    (tasks: string, workerCount = 0) => post('/run/start', { tasks, worker_count: workerCount }),
  runs:        () => get<RunRecord[]>('/runs'),
  run:         (id: string) => get<RunRecord>(`/runs/${encodeURIComponent(id)}`),
  reviews:     () => get<ReviewsPayload>('/reviews'),
  startReview: (workerId: string, taskId: string) => post(`/agents/${encodeURIComponent(workerId)}/review`, { task_id: taskId }),
  pushBranch:  (id: string, force = false) => postJSON<AgentPushResult>(`/agents/${encodeURIComponent(id)}/push`, { force }),
  respawn:     (id: string) => postJSON<{ status: string; agent_id: string; pid: number; task_id: string; branch: string }>(`/agents/${encodeURIComponent(id)}/respawn`, {}),
  mergeBranch: (id: string, into = 'main') => postJSON<AgentMergeResult>(`/agents/${encodeURIComponent(id)}/merge`, { into }),
  createTask:  (body: { title: string; priority?: string; risk?: string; owner?: string; depends_on?: string[] }) =>
    postJSON<import('../types').Task>('/tasks', body),
  stopRun:     () => post('/run/stop'),
}

export type SSEPayload =
  | { type: 'agents';      data: AgentStatus[] }
  | { type: 'events';      data: OrchestratorEvent[] }
  | { type: 'approvals';   data: Approval[] }
  | { type: 'tasks';       data: Task[] }
  | { type: 'messages';    data: AgentMessage[] }
  | { type: 'checkpoints'; data: Checkpoint[] }
  | { type: 'reviews';     data: ReviewsPayload }

export function openStream(onMessage: (payload: SSEPayload) => void): () => void {
  const es = new EventSource('/api/stream')

  const handle = (e: MessageEvent) => {
    try { onMessage(JSON.parse(e.data) as SSEPayload) } catch { /* skip malformed */ }
  }

  es.addEventListener('agents',    handle)
  es.addEventListener('events',    handle)
  es.addEventListener('approvals', handle)
  es.addEventListener('tasks',     handle)
  es.addEventListener('messages',  handle)
  es.addEventListener('reviews',   handle)

  return () => es.close()
}
