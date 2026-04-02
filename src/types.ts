import type { StatusId } from './components/ui';

export type ViewMode = 'office' | 'dashboard' | 'board';

export interface Agent {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string | null;
  current_task_id: string | null;
}

export interface Lane {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: StatusId;
  agent_id: string | null;
  lane_id: string | null;
  deadline: number | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  promise_date: string | null;
  delivery_notes: string | null;
  request_summary: string | null;
  completion_summary: string | null;
  progress_summary: string | null;
  next_step: string | null;
  model_used: string | null;
  source: string | null;
  requester: string | null;
  agent_name?: string | null;
  lane_name?: string | null;
  lane_color?: string | null;
}

export interface Evidence {
  id: string;
  task_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: number;
}

export interface Approval {
  id: string;
  task_id: string;
  decision: 'approve' | 'request_changes' | 'send_back';
  notes: string | null;
  decided_by: string;
  decided_at: number;
}

export interface PRTracking {
  id: string;
  task_id: string;
  pr_number: number;
  pr_url: string;
  status: string;
  ci_status: string;
  last_checked: number;
}

export interface TaskHistoryEvent {
  id: string;
  task_id: string;
  event_type: string;
  actor: string;
  summary: string;
  created_at: number;
  details?: Record<string, unknown> | null;
}

export interface TaskDetail extends Task {
  agent: Agent | null;
  lane: Lane | null;
  evidence: Evidence[];
  approvals: Approval[];
  prs: PRTracking[];
  office_report?: { review_status: string; reviewed_by: string | null; approved_by: string | null; approved_at: number | null; model_used: string | null } | null;
  history: TaskHistoryEvent[];
}

export interface StatusResponse {
  gateway_connected: number;
  last_update: number;
}

export interface DashboardStats {
  totalTasks: number;
  byStatus: Record<StatusId, number>;
  overdue: number;
  dueSoon: number;
  dueVerySoon: number;
  blocked: number;
  activeAgents: number;
  laneStats: Array<{
    id: string;
    name: string;
    color: string;
    total: number;
    completed: number;
    completionRate: number;
  }>;
  recentActivity: Task[];
  recentCompletions: Task[];
  activeWork: Task[];
}

export interface TaskCostSummary {
  totals: {
    tokens: number;
    estimated: number;
    actual: number;
  };
}

export interface TaskDraft {
  title: string;
  description: string;
  request_summary: string;
  status: StatusId;
  agent_id: string;
  lane_id: string;
  deadline: string;
  promise_date: string;
  blocker_reason: string;
  completion_summary: string;
  progress_summary: string;
  next_step: string;
  model_used: string;
  delivery_notes: string;
  source: string;
  requester: string;
}

export const EMPTY_DRAFT: TaskDraft = {
  title: '',
  description: '',
  request_summary: '',
  status: 'backlog',
  agent_id: '',
  lane_id: '',
  deadline: '',
  promise_date: '',
  blocker_reason: '',
  completion_summary: '',
  progress_summary: '',
  next_step: '',
  model_used: '',
  delivery_notes: '',
  source: 'telegram',
  requester: 'Philip',
};
