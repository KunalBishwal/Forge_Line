import type {
  JobStatus,
  JobStatusChangedEvent,
  QueueStatsUpdatedEvent,
  WorkerHeartbeatEvent,
  WorkerStatusChangedEvent,
} from "@/lib/types";
import { jobs, queues, statsForQueue, workers } from "./store";

type Listener = (payload: unknown) => void;

// A tiny local event bus that simulates the Socket.io server for demo mode.
class MockEmitter {
  private listeners = new Map<string, Set<Listener>>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private started = false;

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    this.start();
    return () => this.listeners.get(event)?.delete(cb);
  }

  private send(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  private start() {
    if (this.started) return;
    this.started = true;

    // Job status transitions
    const flow: Record<string, JobStatus> = {
      queued: "claimed",
      claimed: "running",
      running: "completed",
    };
    this.timers.push(
      setInterval(() => {
        const candidates = jobs.filter((j) => flow[j.status]);
        if (!candidates.length) return;
        const job = candidates[Math.floor(Math.random() * candidates.length)];
        const from = job.status;
        // small chance running -> failed/dead_letter for visual variety
        let to = flow[from];
        if (from === "running" && Math.random() < 0.18) {
          to = job.attempts + 1 >= job.maxAttempts ? "dead_letter" : "failed";
        }
        job.status = to;
        job.updatedAt = new Date().toISOString();
        if (to === "failed" || to === "dead_letter") job.attempts += 1;
        const evt: JobStatusChangedEvent = {
          jobId: job.id,
          queueId: job.queueId,
          projectId: job.projectId,
          from,
          to,
          workerId: job.workerId,
          at: job.updatedAt,
        };
        this.send("job:status_changed", evt);
        // keep some jobs flowing by re-queuing completed ones occasionally
        if (to === "completed" && Math.random() < 0.5) {
          setTimeout(() => {
            job.status = "queued";
            job.attempts = 0;
          }, 4000);
        }
      }, 900),
    );

    // Queue stats
    this.timers.push(
      setInterval(() => {
        const q = queues[Math.floor(Math.random() * queues.length)];
        if (q.paused) return;
        q.activeCount = Math.max(0, Math.min(q.concurrency, q.activeCount + Math.floor(Math.random() * 5) - 2));
        const evt: QueueStatsUpdatedEvent = { queueId: q.id, stats: statsForQueue(q.id) };
        this.send("queue:stats_updated", evt);
      }, 1500),
    );

    // Worker heartbeats
    this.timers.push(
      setInterval(() => {
        workers.forEach((w) => {
          if (w.status === "offline") return;
          w.currentLoad = Math.max(0, Math.min(1, w.currentLoad + (Math.random() - 0.5) * 0.2));
          w.activeJobs = Math.round(w.currentLoad * w.concurrency);
          w.lastHeartbeatAt = new Date().toISOString();
          const evt: WorkerHeartbeatEvent = {
            workerId: w.id,
            load: w.currentLoad,
            activeJobs: w.activeJobs,
            at: w.lastHeartbeatAt,
          };
          this.send("worker:heartbeat", evt);
        });
      }, 2500),
    );

    // Occasional worker status flip
    this.timers.push(
      setInterval(() => {
        const w = workers[Math.floor(Math.random() * workers.length)];
        if (w.id === "wrk_05") return; // keep one reliably offline
        const next = w.currentLoad > 0.7 ? "busy" : w.currentLoad < 0.1 ? "idle" : "online";
        if (next !== w.status) {
          w.status = next;
          const evt: WorkerStatusChangedEvent = { workerId: w.id, status: next, at: new Date().toISOString() };
          this.send("worker:status_changed", evt);
        }
      }, 6000),
    );
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.started = false;
  }
}

export const mockEmitter = new MockEmitter();