import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Topbar } from "@/components/layout/Topbar";
import { useOrgProject } from "@/context/OrgProjectProvider";
import { nextIn, relTime } from "@/lib/format";
import * as api from "@/lib/api";

export default function ScheduledJobs() {
  const { projectId } = useOrgProject();
  const qc = useQueryClient();
  const sched = useQuery({ queryKey: ["scheduled", projectId], queryFn: () => api.listScheduled(projectId!), enabled: !!projectId });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setScheduledActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled", projectId] }),
    onError: () => toast.error("Action failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteScheduled(id),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["scheduled", projectId] }); },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <>
      <Topbar title="Scheduled Jobs" subtitle="Cron and recurring pipelines" />
      {sched.isLoading ? (
        <div className="grid gap-3"><CardSkeleton /><CardSkeleton /></div>
      ) : sched.isError ? (
        <ErrorState message="Could not load scheduled jobs." onRetry={() => sched.refetch()} />
      ) : !sched.data?.length ? (
        <EmptyState icon={CalendarClock} title="No scheduled jobs" message="Recurring pipelines you create will appear here." />
      ) : (
        <div className="grid gap-3">
          {sched.data.map((s) => (
            <GlassPanel key={s.id} interactive className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h3 className="font-display text-base text-steel">{s.name}</h3>
                <p className="font-mono text-[11px] text-steel-muted">
                  <span className="text-cyan-flow">{s.cron}</span> · {s.queueName} · next {s.active ? nextIn(s.nextRunAt) : "paused"} · last {relTime(s.lastRunAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                  className={`relative h-6 w-11 rounded-full transition ${s.active ? "bg-ember" : "bg-white/10"}`}
                  aria-label={s.active ? "Deactivate" : "Activate"}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.active ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <button onClick={() => del.mutate(s.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-steel-muted transition hover:border-crimson-fail/40 hover:text-crimson-fail" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </>
  );
}
