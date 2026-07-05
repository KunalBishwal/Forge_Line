import { API_URL, REFRESH_KEY, TOKEN_KEY, isMockMode } from "./config";
import * as db from "./mocks/store";
import type {
  AuthTokens,
  DlqEntry,
  Job,
  JobStatus,
  OrgMember,
  Organization,
  Project,
  Queue,
  QueueStats,
  RetryPolicy,
  ScheduledJob,
  ThroughputPoint,
  UserProfile,
  Worker,
} from "./types";

// ---------------- token helpers ----------------
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefresh = () => localStorage.getItem(REFRESH_KEY);
export function setTokens(t: AuthTokens) {
  localStorage.setItem(TOKEN_KEY, t.accessToken);
  localStorage.setItem(REFRESH_KEY, t.refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ---------------- real HTTP layer ----------------
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function raw<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && getRefresh()) {
    const ok = await tryRefresh();
    if (ok) return raw<T>(method, path, body, false);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = (j.message as string) || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  // Backend TransformInterceptor wraps responses in { success: true, data: ... }
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: getRefresh() }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const tokens = (json && typeof json === "object" && "success" in json && "data" in json) 
      ? (json.data as AuthTokens)
      : (json as AuthTokens);
    setTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

// ---------------- mock helpers ----------------
const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------------- Auth ----------------
export async function login(email: string, _password: string): Promise<{ tokens: AuthTokens; user: UserProfile }> {
  if (isMockMode()) {
    await delay();
    const tokens = { accessToken: "mock.access." + Date.now(), refreshToken: "mock.refresh" };
    setTokens(tokens);
    return { tokens, user: { id: "usr_demo", email, name: email.split("@")[0] } };
  }
  const tokens = await raw<AuthTokens>("POST", "/auth/login", { email, password: _password });
  setTokens(tokens);
  const user = await raw<UserProfile>("GET", "/auth/profile");
  return { tokens, user };
}

export async function register(email: string, password: string, name?: string) {
  if (isMockMode()) {
    await delay();
    const tokens = { accessToken: "mock.access." + Date.now(), refreshToken: "mock.refresh" };
    setTokens(tokens);
    return { tokens, user: { id: "usr_demo", email, name: name || email.split("@")[0] } };
  }
  const tokens = await raw<AuthTokens>("POST", "/auth/register", { email, password, name });
  setTokens(tokens);
  const user = await raw<UserProfile>("GET", "/auth/profile");
  return { tokens, user };
}

export async function getProfile(): Promise<UserProfile> {
  if (isMockMode()) return { id: "usr_demo", email: "operator@forgeline.io", name: "Operator" };
  return raw<UserProfile>("GET", "/auth/profile");
}

// ---------------- Organizations / Projects ----------------
export async function listOrganizations(): Promise<Organization[]> {
  if (isMockMode()) return clone(db.orgs);
  return raw("GET", "/organizations");
}
export async function listMembers(orgId: string): Promise<OrgMember[]> {
  if (isMockMode())
    return [
      { id: "usr_demo", email: "operator@forgeline.io", name: "Operator", role: "owner" },
      { id: "usr_02", email: "mika@forgeline.io", name: "Mika", role: "admin" },
    ];
  return raw("GET", `/organizations/${orgId}/members`);
}
export async function listProjects(orgId: string): Promise<Project[]> {
  if (isMockMode()) return clone(db.projects.filter((p) => p.orgId === orgId));
  return raw("GET", `/organizations/${orgId}/projects`);
}
export async function listRetryPolicies(orgId: string, projectId: string): Promise<RetryPolicy[]> {
  if (isMockMode()) return clone(db.retryPolicies);
  return raw("GET", `/organizations/${orgId}/projects/${projectId}/retry-policies`);
}

// ---------------- Queues ----------------
function mapQueue(q: any): Queue {
  if (!q) return q;
  return {
    ...q,
    concurrency: q.concurrencyLimit ?? q.concurrency ?? 8,
    paused: q.isPaused ?? q.paused ?? false,
  };
}

export async function listQueues(projectId: string): Promise<Queue[]> {
  if (isMockMode()) return clone(db.queues.filter((q) => q.projectId === projectId));
  const qs = await raw<any[]>("GET", `/projects/${projectId}/queues`);
  return qs.map(mapQueue);
}
export async function getQueue(projectId: string, queueId: string): Promise<Queue> {
  if (isMockMode()) return clone(db.queues.find((q) => q.id === queueId)!);
  const q = await raw<any>("GET", `/projects/${projectId}/queues/${queueId}`);
  return mapQueue(q);
}
export async function createQueue(projectId: string, input: Partial<Queue>): Promise<Queue> {
  if (isMockMode()) {
    await delay();
    const q: Queue = {
      id: db.nid("q"),
      projectId,
      name: input.name || "new-line",
      priority: input.priority ?? 5,
      concurrency: input.concurrency ?? 8,
      activeCount: 0,
      paused: false,
      retryPolicyId: input.retryPolicyId || "rp_default",
    };
    db.queues.push(q);
    return clone(q);
  }
  return raw("POST", `/projects/${projectId}/queues`, {
    name: input.name,
    concurrencyLimit: input.concurrency,
    priority: input.priority,
    retryPolicyId: input.retryPolicyId,
  });
  return mapQueue(q);
}
export async function setQueuePaused(projectId: string, queueId: string, paused: boolean): Promise<Queue> {
  if (isMockMode()) {
    await delay(180);
    const q = db.queues.find((x) => x.id === queueId)!;
    q.paused = paused;
    return clone(q);
  }
  const q = await raw<any>("PATCH", `/projects/${projectId}/queues/${queueId}/${paused ? "pause" : "resume"}`);
  return mapQueue(q);
}
export async function getQueueStats(projectId: string, queueId: string): Promise<QueueStats> {
  if (isMockMode()) return db.statsForQueue(queueId);
  return raw("GET", `/projects/${projectId}/queues/${queueId}/stats`);
}

// ---------------- Jobs ----------------
export interface JobFilter {
  status?: JobStatus | "all";
  queueId?: string;
  projectId?: string;
  q?: string;
}
export async function listJobs(filter: JobFilter): Promise<Job[]> {
  if (isMockMode()) {
    await delay(150);
    let out = db.jobs.slice();
    if (filter.projectId) out = out.filter((j) => j.projectId === filter.projectId);
    if (filter.queueId) out = out.filter((j) => j.queueId === filter.queueId);
    if (filter.status && filter.status !== "all") out = out.filter((j) => j.status === filter.status);
    if (filter.q) {
      const s = filter.q.toLowerCase();
      out = out.filter((j) => j.id.toLowerCase().includes(s) || j.type.toLowerCase().includes(s));
    }
    return clone(out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => v && v !== "all" && params.set(k, String(v)));
  const res = await raw<{ data: Job[]; meta: any }>("GET", `/jobs?${params.toString()}`);
  return res.data;
}
export async function getJob(jobId: string): Promise<Job> {
  if (isMockMode()) return clone(db.jobs.find((j) => j.id === jobId)!);
  return raw("GET", `/jobs/${jobId}`);
}
export async function retryJob(jobId: string): Promise<Job> {
  if (isMockMode()) {
    await delay(160);
    const j = db.jobs.find((x) => x.id === jobId)!;
    j.status = "queued";
    j.attempts = 0;
    j.updatedAt = new Date().toISOString();
    return clone(j);
  }
  return raw("PATCH", `/jobs/${jobId}/retry`);
}
export async function cancelJob(jobId: string): Promise<Job> {
  if (isMockMode()) {
    await delay(160);
    const j = db.jobs.find((x) => x.id === jobId)!;
    j.status = "cancelled";
    j.updatedAt = new Date().toISOString();
    return clone(j);
  }
  return raw("PATCH", `/jobs/${jobId}/cancel`);
}

// ---------------- Scheduled Jobs ----------------
export async function listScheduled(projectId: string): Promise<ScheduledJob[]> {
  if (isMockMode()) return clone(db.scheduled.filter((s) => s.projectId === projectId));
  return raw("GET", `/scheduled-jobs?projectId=${projectId}`);
}
export async function setScheduledActive(id: string, active: boolean): Promise<ScheduledJob> {
  if (isMockMode()) {
    await delay(160);
    const s = db.scheduled.find((x) => x.id === id)!;
    s.active = active;
    return clone(s);
  }
  return raw("PATCH", `/scheduled-jobs/${id}/${active ? "activate" : "deactivate"}`);
}
export async function deleteScheduled(id: string): Promise<void> {
  if (isMockMode()) {
    await delay(160);
    const i = db.scheduled.findIndex((x) => x.id === id);
    if (i >= 0) db.scheduled.splice(i, 1);
    return;
  }
  return raw("DELETE", `/scheduled-jobs/${id}`);
}

// ---------------- DLQ ----------------
export async function listDlq(projectId?: string): Promise<DlqEntry[]> {
  if (isMockMode()) {
    await delay(150);
    let out = db.dlq.slice();
    if (projectId) {
      const qIds = new Set(db.queues.filter((q) => q.projectId === projectId).map((q) => q.id));
      out = out.filter((d) => qIds.has(d.queueId));
    }
    return clone(out.sort((a, b) => b.failedAt.localeCompare(a.failedAt)));
  }
  const res = await raw<{ data: DlqEntry[]; meta: any }>("GET", `/dlq${projectId ? `?projectId=${projectId}` : ""}`);
  return res.data;
}
export async function replayDlq(id: string): Promise<void> {
  if (isMockMode()) {
    await delay(200);
    const i = db.dlq.findIndex((x) => x.id === id);
    if (i >= 0) db.dlq.splice(i, 1);
    return;
  }
  return raw("POST", `/dlq/${id}/replay`);
}
export async function deleteDlq(id: string): Promise<void> {
  if (isMockMode()) {
    await delay(160);
    const i = db.dlq.findIndex((x) => x.id === id);
    if (i >= 0) db.dlq.splice(i, 1);
    return;
  }
  return raw("DELETE", `/dlq/${id}`);
}

// ---------------- Workers ----------------
function mapWorker(w: any): Worker {
  if (!w) return w;
  const activeJobs = w.currentLoad ?? 0;
  const concurrency = w.maxConcurrency ?? 10;
  return {
    ...w,
    activeJobs,
    concurrency,
    currentLoad: concurrency > 0 ? activeJobs / concurrency : 0,
  };
}

export async function listWorkers(): Promise<Worker[]> {
  if (isMockMode()) return clone(db.workers);
  const ws = await raw<any[]>("GET", "/workers");
  return ws.map(mapWorker);
}
export async function getWorker(id: string): Promise<Worker> {
  if (isMockMode()) return clone(db.workers.find((w) => w.id === id)!);
  const w = await raw<any>("GET", `/workers/${id}`);
  return mapWorker(w);
}

// ---------------- Analytics ----------------
export async function getThroughput(): Promise<ThroughputPoint[]> {
  // Backend doesn't support historical analytics yet, so we use the mock generator
  return db.throughputHistory();
}