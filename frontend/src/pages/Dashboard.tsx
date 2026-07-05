import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Cpu, Skull } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/Loading";
import { Pipeline3D } from "@/components/dashboard/Pipeline3D";
import { Pipeline2DStrip } from "@/components/dashboard/Pipeline2DStrip";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { Topbar } from "@/components/layout/Topbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrgProject } from "@/context/OrgProjectProvider";
import * as api from "@/lib/api";

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { projectId } = useOrgProject();
  const workers = useQuery({ queryKey: ["workers"], queryFn: api.listWorkers });
  const jobs = useQuery({ queryKey: ["jobs", { projectId }], queryFn: () => api.listJobs({ projectId: projectId ?? undefined }), enabled: !!projectId });
  const throughput = useQuery({ queryKey: ["throughput"], queryFn: api.getThroughput });

  const online = workers.data?.filter((w) => w.status !== "offline").length ?? 0;
  const active = jobs.data?.filter((j) => ["running", "claimed"].includes(j.status)).length ?? 0;
  const completed = jobs.data?.filter((j) => j.status === "completed").length ?? 0;
  const failed = jobs.data?.filter((j) => ["failed", "dead_letter"].includes(j.status)).length ?? 0;

  return (
    <>
      <Topbar title="Control Deck" subtitle="Live foundry overview" />

      <GlassPanel deep className="overflow-hidden p-1">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="font-display text-sm uppercase tracking-wider text-steel-muted">Live Pipeline</h2>
          <span className="font-mono text-[11px] text-cyan-flow">● streaming</span>
        </div>
        <div className="h-[360px] w-full">
          {isMobile ? <Pipeline2DStrip /> : <Pipeline3D />}
        </div>
      </GlassPanel>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {workers.isLoading ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <StatCard label="Worker Fleet" value={online} icon={Cpu} accent="cyan" hint={`${workers.data?.length ?? 0} total nodes`} />
            <StatCard label="Active Jobs" value={active} icon={Activity} accent="ember" hint="running + claimed" />
            <StatCard label="Completed" value={completed} icon={CheckCircle2} accent="emerald" hint="this window" />
            <StatCard label="Failed / DLQ" value={failed} icon={Skull} accent="crimson" hint="needs attention" />
          </>
        )}
      </div>

      <GlassPanel className="p-5">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wider text-steel-muted">Throughput · last 24h</h2>
        {throughput.data ? <ThroughputChart data={throughput.data} /> : <CardSkeleton />}
      </GlassPanel>
    </>
  );
}
