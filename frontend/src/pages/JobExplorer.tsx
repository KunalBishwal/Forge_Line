import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { Search } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RowSkeleton } from "@/components/ui/Loading";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { JobsTable } from "@/components/jobs/JobsTable";
import { JobDetailDrawer } from "@/components/jobs/JobDetailDrawer";
import { Topbar } from "@/components/layout/Topbar";
import { useOrgProject } from "@/context/OrgProjectProvider";
import * as api from "@/lib/api";
import type { JobStatus } from "@/lib/types";

const STATUSES: (JobStatus | "all")[] = ["all", "queued", "claimed", "running", "completed", "failed", "dead_letter", "cancelled"];

export default function JobExplorer() {
  const { projectId } = useOrgProject();
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const debouncedQ = useDebounce(q, 300);

  const jobs = useQuery({
    queryKey: ["jobs", { projectId, status, q: debouncedQ }],
    queryFn: () => api.listJobs({ projectId: projectId ?? undefined, status, q: debouncedQ }),
    enabled: !!projectId,
  });

  return (
    <>
      <Topbar title="Job Explorer" subtitle="Search and inspect every job" />

      <GlassPanel className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Search className="h-4 w-4 text-steel-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by id or type…" className="w-full bg-transparent text-sm text-steel outline-none placeholder:text-steel-muted/60" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition ${status === s ? "border border-ember/40 bg-ember/10 text-ember" : "border border-white/10 text-steel-muted hover:text-steel"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        {jobs.isLoading ? (
          <div><RowSkeleton /><RowSkeleton /><RowSkeleton /><RowSkeleton /></div>
        ) : jobs.isError ? (
          <ErrorState message="Could not load jobs." onRetry={() => jobs.refetch()} />
        ) : jobs.data?.length ? (
          <JobsTable jobs={jobs.data} onSelect={(j) => setSelected(j.id)} />
        ) : (
          <EmptyState icon={Search} title="No jobs match" message="Try a different status filter or search term." />
        )}
      </GlassPanel>

      <JobDetailDrawer jobId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
