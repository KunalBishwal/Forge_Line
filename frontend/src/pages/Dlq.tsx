import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageX, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Topbar } from "@/components/layout/Topbar";
import { useOrgProject } from "@/context/OrgProjectProvider";
import { relTime } from "@/lib/format";
import * as api from "@/lib/api";

export default function Dlq() {
  const { projectId } = useOrgProject();
  const qc = useQueryClient();
  const dlq = useQuery({ queryKey: ["dlq", projectId], queryFn: () => api.listDlq(projectId ?? undefined) });

  const replay = useMutation({
    mutationFn: (id: string) => api.replayDlq(id),
    onSuccess: () => { toast.success("Replayed"); qc.invalidateQueries({ queryKey: ["dlq"] }); },
    onError: () => toast.error("Replay failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteDlq(id),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["dlq"] }); },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <>
      <Topbar title="Scrap Bin" subtitle="Failed jobs needing intervention" />
      {dlq.isLoading ? (
        <div className="grid gap-4"><CardSkeleton /><CardSkeleton /></div>
      ) : dlq.isError ? (
        <ErrorState message="Could not load the scrap bin." onRetry={() => dlq.refetch()} />
      ) : !dlq.data?.length ? (
        <EmptyState icon={PackageX} title="Scrap Bin is empty" message="All pipelines nominal — no jobs have been sent to the dead letter queue." />
      ) : (
        <div className="grid gap-4">
          {dlq.data.map((e) => (
            <GlassPanel key={e.id} interactive className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base text-steel">{e.type}</h3>
                  <p className="font-mono text-[11px] text-steel-muted">{e.queueName} · {e.attempts} attempts · failed {relTime(e.failedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => replay.mutate(e.id)} disabled={replay.isPending} className="flex items-center gap-1.5 rounded-lg border border-cyan-flow/40 bg-cyan-flow/10 px-3 py-1.5 text-xs text-cyan-flow transition hover:bg-cyan-flow/20 disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Replay
                  </button>
                  <button onClick={() => del.mutate(e.id)} disabled={del.isPending} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-steel-muted transition hover:border-crimson-fail/40 hover:text-crimson-fail disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-ember/25 bg-gradient-to-r from-ember/10 to-transparent p-4">
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ember">
                  <Sparkles className="h-3.5 w-3.5" /> AI failure summary
                </div>
                <p className="text-sm leading-relaxed text-steel">{e.aiSummary}</p>
              </div>
              <pre className="mt-3 overflow-auto rounded-lg border border-crimson-fail/20 bg-crimson-fail/5 p-3 font-mono text-[11px] text-crimson-fail">{e.error}</pre>
            </GlassPanel>
          ))}
        </div>
      )}
    </>
  );
}
