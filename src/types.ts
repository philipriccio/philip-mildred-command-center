import type { StatusId } from './components/ui';

export type ViewMode = 'hub' | 'office' | 'dashboard' | 'board' | 'projects';

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

export type OpsStatus = 'green' | 'yellow' | 'red';

export interface SelfTapeLiveStatus {
  branch: string | null;
  head: string | null;
  dirty: boolean;
  buildNumber: string | null;
  appleProcessing: {
    build: string;
    status: 'processing' | 'available' | 'unknown';
    testFlightUrl: string;
    submittedAt: string | null;
  };
  easIncident: {
    active: boolean;
    title: string | null;
    summary: string | null;
    checkedAt: number;
  };
  buildAttempts: Array<{
    build: string;
    status: string;
    note: string;
  }>;
  recommendedAction: string;
  sourcePath: string;
}

export interface DiagnosticEventRow {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  flow: string | null;
  screen: string | null;
  error_code: string | null;
  message: string | null;
  app_platform: string | null;
  app_version: string | null;
  build_number: string | null;
  os_version: string | null;
}

export interface SelfTapeDiagnosticsResponse {
  configured: boolean;
  source: string;
  checkedAt: number;
  events: DiagnosticEventRow[];
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    byBuild: Array<{ buildNumber: string; count: number }>;
    byFlow: Array<{ flow: string; count: number }>;
    byType: Array<{ eventType: string; count: number; latestAt: string | null }>;
    lastEventAt: string | null;
    readiness: 'no-events' | 'quiet' | 'watch' | 'investigate';
    recommendation: string;
  };
  error?: string;
}

export interface SelfTapeOpsData {
  northStar: {
    goal: string;
    strategy: string;
    phase: string;
    currentRecommendation: string;
  };
  authority: {
    green: string[];
    yellow: string[];
    red: string[];
  };
  journey: Array<{
    step: string;
    status: OpsStatus;
    evidence: string;
    nextAction: string;
  }>;
  proactiveLoops: Array<{
    cadence: string;
    name: string;
    output: string;
    trigger: string;
  }>;
  risks: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    owner: string;
    status: string;
  }>;
  opportunities: Array<{
    title: string;
    impact: string;
    nextAction: string;
  }>;
  decisions: Array<{
    title: string;
    neededFrom: string;
    recommendation: string;
    timing: string;
  }>;
  watchedSignals: Array<{
    signal: string;
    whyItMatters: string;
    response: string;
  }>;
  actionPackets: Array<{
    title: string;
    owner: 'Mildred' | 'Philip' | 'Dev' | 'Janet' | 'Shared';
    status: 'ready' | 'waiting' | 'blocked' | 'in_progress';
    approvalNeeded: boolean;
    nextStep: string;
  }>;
  deviceTestScript: Array<{
    title: string;
    purpose: string;
    steps: string[];
    passSignal: string;
    failureEvidence: string;
  }>;
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

export type WorkItemStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  color: string;
  repo_url: string | null;
  live_url: string | null;
  local_path: string | null;
  description: string | null;
  created_at: number;
  updated_at: number;
  open_work_items_count: number;
  work_items_count: number;
}

export interface WorkItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: number;
  status: WorkItemStatus;
  assigned_agent: string | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
    everyMs?: number;
    at?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
    lastErrorReason?: string;
    lastDelivered?: boolean;
    lastDeliveryStatus?: string;
  };
}


export interface ProjectCockpitSection {
  title: string;
  status: 'green' | 'yellow' | 'red' | 'slate';
  body: string;
  evidence?: string;
  nextAction?: string;
}

export interface SelfTapeBlocker {
  id: string;
  title: string;
  goal: string;
  currentTruth: string;
  whyItBlocksBeta: string;
  nextAction: string;
  status: 'blocked' | 'in_progress' | 'waiting' | 'watching';
  proofLevel: string;
  reports: Array<{ label: string; path?: string; note: string }>;
}

export interface ProjectCockpit {
  type: 'selftape' | 'generic';
  freshness: 'live' | 'mixed' | 'static' | 'unavailable';
  title: string;
  updatedAt: number;
  summary: string;
  evidenceLabel: string;
  warnings: string[];
  mission?: string;
  betaStatus?: {
    label: string;
    body: string;
  };
  betaBlockers?: SelfTapeBlocker[];
  secondaryAreas?: Array<{
    title: string;
    status: 'ok' | 'needs_work' | 'unknown';
    note: string;
  }>;
  reports?: Array<{ label: string; path?: string; note: string }>;
  sections: ProjectCockpitSection[];
  links?: Array<{ label: string; href: string }>;
}

export interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  color: string;
  repo_url: string | null;
  live_url: string | null;
  local_path: string | null;
  description: string | null;
  created_at: number;
  updated_at: number;
  work_items: WorkItem[];
  cron_job_ids: string[];
  cron_jobs: CronJob[];
  cockpit?: ProjectCockpit;
}

export interface ProtectedWorkCategory {
  category: string;
  timeCommitted: string;
  progress: string;
  notes: string;
}

export interface ProtectedWorkResponse {
  week: string;
  updatedAt: number;
  source: string;
  categories: ProtectedWorkCategory[];
}
