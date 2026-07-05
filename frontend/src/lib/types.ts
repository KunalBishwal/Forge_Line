// ---- Forgeline domain types (mirror the backend REST contract) ----

export type JobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "dead_letter"
  | "cancelled";

export type WorkerStatus = "online" | "idle" | "busy" | "offline";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  role?: string;
}

export interface OrgMember {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface RetryPolicy {
  id: string;
  name: string;
  maxAttempts: number;
  backoff: "fixed" | "exponential" | "linear";
  delayMs: number;
}

export interface Queue {
  id: string;
  projectId: string;
  name: string;
  priority: number;
  concurrency: number;
  activeCount: number;
  paused: boolean;
  retryPolicyId?: string;
}

export interface QueueStats {
  queueId: string;
  queued: number;
  claimed: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
  throughputPerMin: number;
}

export interface JobAttempt {
  attempt: number;
  status: JobStatus;
  workerId?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface Job {
  id: string;
  queueId: string;
  queueName?: string;
  projectId: string;
  type: string;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  workerId?: string;
  createdAt: string;
  updatedAt: string;
  history?: JobAttempt[];
}

export interface ScheduledJob {
  id: string;
  projectId: string;
  name: string;
  cron: string;
  queueId: string;
  queueName?: string;
  jobType: string;
  active: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
}

export interface DlqEntry {
  id: string;
  jobId: string;
  queueId: string;
  queueName?: string;
  type: string;
  attempts: number;
  error: string;
  aiSummary: string;
  failedAt: string;
  payload?: Record<string, unknown>;
}

export interface Heartbeat {
  at: string;
  load: number;
}

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  currentLoad: number;
  concurrency: number;
  activeJobs: number;
  lastHeartbeatAt: string;
  heartbeatIntervalMs: number;
  version?: string;
  region?: string;
  heartbeats?: Heartbeat[];
}

export interface ThroughputPoint {
  t: string;
  completed: number;
  failed: number;
}

// ---- WebSocket event payloads ----
export interface JobStatusChangedEvent {
  jobId: string;
  queueId: string;
  projectId: string;
  from: JobStatus;
  to: JobStatus;
  workerId?: string;
  at: string;
}

export interface QueueStatsUpdatedEvent {
  queueId: string;
  stats: QueueStats;
}

export interface WorkerHeartbeatEvent {
  workerId: string;
  load: number;
  activeJobs: number;
  at: string;
}

export interface WorkerStatusChangedEvent {
  workerId: string;
  status: WorkerStatus;
  at: string;
}