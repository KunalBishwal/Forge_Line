// ─── Job Status ─────────────────────────────────────────
export enum JobStatus {
  QUEUED = 'queued',
  SCHEDULED = 'scheduled',
  CLAIMED = 'claimed',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
  CANCELLED = 'cancelled',
}

// ─── Job Type ───────────────────────────────────────────
export enum JobType {
  IMMEDIATE = 'immediate',
  DELAYED = 'delayed',
  SCHEDULED = 'scheduled',
  RECURRING = 'recurring',
  BATCH = 'batch',
}

// ─── Retry Strategy ─────────────────────────────────────
export enum RetryStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
}

// ─── Worker Status ──────────────────────────────────────
export enum WorkerStatus {
  ONLINE = 'online',
  DRAINING = 'draining',
  OFFLINE = 'offline',
}

// ─── Organization Role ──────────────────────────────────
export enum OrgRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// ─── Log Level ──────────────────────────────────────────
export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

// ─── Execution Status ───────────────────────────────────
export enum ExecutionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
