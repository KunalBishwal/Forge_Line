import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CardSkeleton, RowSkeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { JobsTable } from "@/components/jobs/JobsTable";
import { JobDetailDrawer } from "@/components/jobs/JobDetailDrawer";
import { Topbar } from "@/components/layout/Topbar";
import { useOrgProject } from "@/context/OrgProjectProvider";
import * as api from "@/lib/api";
import { Inbox } from "lucide-react";

export default function QueueDetail() {
  const { queueId = "" } = useParams();
  const { projectId } = useOrgProject();
  const [selected, setSelected] = useState<string | null>(null);

  const queue = useQuery({ queryKey: ["queue", queueId], queryFn: () => api.getQueue(projectId!, queueId), enabled: !!projectId });
  const stats = useQuery({ queryKey: ["queue-stats", queueId], queryFn: () => api.getQueueStats(projectId!, queueId), enabled: !!projectId });
  const jobs = useQuery({ queryKey: ["jobs", { queueId }], queryFn: () => api.listJobs({ queueId }) });
  const policies = useQuery({ queryKey: ["retry-policies", projectId], queryFn: () => api.listRetryPolicies("org", projectId!), enabled: !!projectId });

  const policy = policies.data?.find((p) => p.id === queue.data?.retryPolicyId);

  return (
    <>
      <Link to="/queues" className="inline-flex items-center gap-2 font-mono text-xs text-steel-muted hover:text-steel">
        <ArrowLeft className="h-4 w-4" /> production lines
      </Link>
      <Topbar title={queue.data?.name ?? "Queue"} subtitle={queueId} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.data ? (
          [
            ["Queued", stats.data.queued],
            ["Running", stats.data.running],
            ["Completed", stats.data.completed],
            ["Dead Letter", stats.data.deadLetter],
          ].map(([l, v]) => (
            <GlassPanel key={l as string} className="p-4">
              <div className="text-xs uppercase tracking-wider text-steel-muted">{l}</div>
              <div className="mt-2 font-display text-3xl text-steel">{v as number}</div>
            </GlassPanel>
          ))
        ) : (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        )}
      </div>

      {policy && (
        <GlassPanel className="p-5">
          <h2 className="mb-3 font-display text-sm uppercase tracking-wider text-steel-muted">Retry Policy</h2>
          <div className="grid grid-cols-3 gap-3 font-mono text-sm">
            <div><div className="text-[11px] text-steel-muted">policy</div><div className="text-steel">{policy.name}</div></div>
            <div><div className="text-[11px] text-steel-muted">max attempts</div><div className="text-steel">{policy.maxAttempts}</div></div>
            <div><div className="text-[11px] text-steel-muted">backoff</div><div className="text-steel">{policy.backoff} · {policy.delayMs}ms</div></div>
          </div>
        </GlassPanel>
      )}

      <GlassPanel className="overflow-hidden">
        <h2 className="border-b border-white/10 px-4 py-3 font-display text-sm uppercase tracking-wider text-steel-muted">Jobs</h2>
        {jobs.isLoading ? (
          <div><RowSkeleton /><RowSkeleton /><RowSkeleton /></div>
        ) : jobs.data?.length ? (
          <JobsTable jobs={jobs.data} onSelect={(j) => setSelected(j.id)} />
        ) : (
          <EmptyState icon={Inbox} title="No jobs on this line" message="Jobs will appear here as they are enqueued." />
        )}
      </GlassPanel>

      <JobDetailDrawer jobId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
