import type {
  DlqEntry,
  Job,
  JobStatus,
  Organization,
  Project,
  Queue,
  QueueStats,
  RetryPolicy,
  ScheduledJob,
  ThroughputPoint,
  Worker,
} from "@/lib/types";

// ---------- deterministic id + time helpers ----------
let seq = 1000;
export const nid = (p = "id") => `${p}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// ---------- seed ----------
export const orgs: Organization[] = [
  { id: "org_forge", name: "Forge Industries", slug: "forge", role: "owner" },
  { id: "org_atlas", name: "Atlas Logistics", slug: "atlas", role: "admin" },
];

export const projects: Project[] = [
  { id: "prj_smelt", orgId: "org_forge", name: "Smelter", description: "Media transcode pipeline", createdAt: ago(6000) },
  { id: "prj_cast", orgId: "org_forge", name: "Caster", description: "Billing + invoicing jobs", createdAt: ago(4200) },
  { id: "prj_route", orgId: "org_atlas", name: "Router", description: "Shipment routing engine", createdAt: ago(3000) },
];

export const retryPolicies: RetryPolicy[] = [
  { id: "rp_default", name: "Standard Exponential", maxAttempts: 5, backoff: "exponential", delayMs: 2000 },
  { id: "rp_fast", name: "Fast Fixed", maxAttempts: 3, backoff: "fixed", delayMs: 500 },
];

const QTYPES = ["transcode.video", "thumbnail.generate", "invoice.render", "email.send", "route.optimize", "report.build"];

export const queues: Queue[] = [
  { id: "q_transcode", projectId: "prj_smelt", name: "transcode-line", priority: 9, concurrency: 24, activeCount: 18, paused: false, retryPolicyId: "rp_default" },
  { id: "q_thumbs", projectId: "prj_smelt", name: "thumbnail-line", priority: 5, concurrency: 12, activeCount: 4, paused: false, retryPolicyId: "rp_fast" },
  { id: "q_billing", projectId: "prj_cast", name: "billing-line", priority: 8, concurrency: 8, activeCount: 6, paused: false, retryPolicyId: "rp_default" },
  { id: "q_mail", projectId: "prj_cast", name: "mail-line", priority: 3, concurrency: 16, activeCount: 0, paused: true, retryPolicyId: "rp_fast" },
  { id: "q_route", projectId: "prj_route", name: "route-line", priority: 7, concurrency: 20, activeCount: 11, paused: false, retryPolicyId: "rp_default" },
];

function makeJob(queue: Queue, status: JobStatus, i: number): Job {
  const attempts = status === "dead_letter" || status === "failed" ? Math.min(queue.priority, 5) : status === "running" ? 1 : status === "completed" ? 1 : 0;
  return {
    id: nid("job"),
    queueId: queue.id,
    queueName: queue.name,
    projectId: queue.projectId,
    type: pick(QTYPES),
    status,
    priority: (i % 10) + 1,
    attempts,
    maxAttempts: 5,
    workerId: status === "running" || status === "claimed" ? pick(workers).id : undefined,
    createdAt: ago(120 - i),
    updatedAt: ago(60 - (i % 60)),
    payload: { ref: nid("ref"), size: Math.floor(Math.random() * 4096) },
    error: status === "failed" || status === "dead_letter" ? "Error: upstream timeout after 30000ms" : undefined,
    history: [
      { attempt: 1, status: "claimed", workerId: "wrk_01", startedAt: ago(30), finishedAt: ago(29) },
      ...(attempts > 1
        ? [{ attempt: 2, status: "failed" as JobStatus, workerId: "wrk_02", startedAt: ago(20), finishedAt: ago(19), error: "ECONNRESET" }]
        : []),
    ],
  };
}

export const workers: Worker[] = [
  { id: "wrk_01", name: "forge-runner-01", status: "busy", currentLoad: 0.82, concurrency: 8, activeJobs: 6, lastHeartbeatAt: now(), heartbeatIntervalMs: 5000, version: "2.4.1", region: "us-east" },
  { id: "wrk_02", name: "forge-runner-02", status: "online", currentLoad: 0.41, concurrency: 8, activeJobs: 3, lastHeartbeatAt: now(), heartbeatIntervalMs: 5000, version: "2.4.1", region: "us-east" },
  { id: "wrk_03", name: "forge-runner-03", status: "idle", currentLoad: 0.06, concurrency: 8, activeJobs: 0, lastHeartbeatAt: now(), heartbeatIntervalMs: 7000, version: "2.4.0", region: "eu-west" },
  { id: "wrk_04", name: "forge-runner-04", status: "busy", currentLoad: 0.94, concurrency: 12, activeJobs: 11, lastHeartbeatAt: now(), heartbeatIntervalMs: 4000, version: "2.4.1", region: "eu-west" },
  { id: "wrk_05", name: "forge-runner-05", status: "offline", currentLoad: 0, concurrency: 8, activeJobs: 0, lastHeartbeatAt: ago(4), heartbeatIntervalMs: 5000, version: "2.3.9", region: "ap-south" },
];

export const jobs: Job[] = [];
(function seedJobs() {
  const dist: JobStatus[] = ["queued", "queued", "claimed", "running", "running", "completed", "completed", "completed", "failed"];
  queues.forEach((q) => {
    for (let i = 0; i < 26; i++) jobs.push(makeJob(q, dist[i % dist.length], i));
  });
})();

export const dlq: DlqEntry[] = queues.slice(0, 4).flatMap((q, qi) =>
  Array.from({ length: qi === 0 ? 4 : 2 }).map((_, i) => ({
    id: nid("dlq"),
    jobId: nid("job"),
    queueId: q.id,
    queueName: q.name,
    type: pick(QTYPES),
    attempts: 5,
    error: pick([
      "TimeoutError: handler exceeded 60s budget",
      "TypeError: Cannot read properties of undefined (reading 'url')",
      "S3AccessDenied: signature expired",
      "OutOfMemory: worker heap exhausted at 512MB",
    ]),
    aiSummary: pick([
      "Root cause: the source asset URL was signed with an expired credential, so every retry hit a 403 before processing. Rotate the storage key and replay.",
      "Handler ran out of heap on large payloads (>400MB). Consider raising worker memory or chunking input before replay.",
      "Upstream API returned malformed JSON missing the `url` field; the transform assumed it was always present. Safe to replay once upstream recovers.",
      "Consistent 60s timeouts point to a slow downstream dependency, not the job itself. Replaying now will likely fail again until latency clears.",
    ]),
    failedAt: ago(15 + i * 7),
    payload: { ref: nid("ref") },
  })),
);

export const scheduled: ScheduledJob[] = [
  { id: nid("sch"), projectId: "prj_smelt", name: "Nightly re-encode", cron: "0 2 * * *", queueId: "q_transcode", queueName: "transcode-line", jobType: "transcode.video", active: true, nextRunAt: ago(-600), lastRunAt: ago(840) },
  { id: nid("sch"), projectId: "prj_cast", name: "Hourly invoice sweep", cron: "0 * * * *", queueId: "q_billing", queueName: "billing-line", jobType: "invoice.render", active: true, nextRunAt: ago(-24), lastRunAt: ago(36) },
  { id: nid("sch"), projectId: "prj_cast", name: "Weekly digest email", cron: "0 9 * * 1", queueId: "q_mail", queueName: "mail-line", jobType: "email.send", active: false, nextRunAt: undefined, lastRunAt: ago(9000) },
  { id: nid("sch"), projectId: "prj_route", name: "5-min route refresh", cron: "*/5 * * * *", queueId: "q_route", queueName: "route-line", jobType: "route.optimize", active: true, nextRunAt: ago(-3), lastRunAt: ago(2) },
];

// ---------- derived ----------
export function statsForQueue(queueId: string): QueueStats {
  const qs = jobs.filter((j) => j.queueId === queueId);
  const count = (s: JobStatus) => qs.filter((j) => j.status === s).length;
  return {
    queueId,
    queued: count("queued"),
    claimed: count("claimed"),
    running: count("running"),
    completed: count("completed"),
    failed: count("failed"),
    deadLetter: dlq.filter((d) => d.queueId === queueId).length,
    throughputPerMin: 40 + Math.floor(Math.random() * 60),
  };
}

export function throughputHistory(): ThroughputPoint[] {
  const pts: ThroughputPoint[] = [];
  for (let i = 23; i >= 0; i--) {
    const base = 60 + Math.sin(i / 3) * 30;
    pts.push({
      t: `${String((new Date().getHours() - i + 48) % 24).padStart(2, "0")}:00`,
      completed: Math.max(0, Math.round(base + Math.random() * 25)),
      failed: Math.max(0, Math.round(Math.random() * 8)),
    });
  }
  return pts;
}