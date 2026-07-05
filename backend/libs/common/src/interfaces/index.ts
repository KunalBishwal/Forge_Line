export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
  timestamp: string;
}

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  orgId?: string;
}

export interface QueueStats {
  queueId: string;
  queueName: string;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
  throughputPerMinute: number;
}

export interface WorkerHealth {
  workerId: string;
  name: string;
  status: string;
  currentLoad: number;
  maxConcurrency: number;
  lastHeartbeatAt: Date;
  memoryMb: number;
  cpuPercent: number;
}

export interface RetryDelayResult {
  delayMs: number;
  nextAttempt: number;
  shouldRetry: boolean;
  moveToDlq: boolean;
}
