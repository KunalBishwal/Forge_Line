import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Ban } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/SideDrawer";
import { StatusPill } from "@/components/ui/StatusPill";
import { Shimmer } from "@/components/ui/Loading";
import { cancelJob, getJob, retryJob } from "@/lib/api";
import { relTime } from "@/lib/format";
import type { Job } from "@/lib/types";

export function JobDetailDrawer({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
  });

  const retry = useMutation({
    mutationFn: () => retryJob(jobId!),
    onSuccess: () => {
      toast.success("Job re-queued");
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Retry failed"),
  });
  const cancel = useMutation({
    mutationFn: () => cancelJob(jobId!),
    onSuccess: () => {
      toast.success("Job cancelled");
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Cancel failed"),
  });

  const active = job && ["queued", "claimed", "running", "failed"].includes(job.status);

  return (
    <Drawer open={!!jobId} onClose={onClose} title={job ? job.type : "Job"}>
      {isLoading || !job ? (
        <div className="space-y-3">
          <Shimmer className="h-6 w-1/2" />
          <Shimmer className="h-24 w-full" />
          <Shimmer className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={job.status} />
            <span className="font-mono text-xs text-cyan-flow">{job.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <Field label="line" value={job.queueName ?? job.queueId} />
            <Field label="priority" value={String(job.priority)} />
            <Field label="attempts" value={`${job.attempts}/${job.maxAttempts}`} />
            <Field label="worker" value={job.workerId ?? "—"} />
            <Field label="created" value={relTime(job.createdAt)} />
            <Field label="updated" value={relTime(job.updatedAt)} />
          </div>

          {job.error && (
            <div className="rounded-xl border border-crimson-fail/30 bg-crimson-fail/10 p-4">
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-crimson-fail">last error</div>
              <pre className="whitespace-pre-wrap font-mono text-xs text-steel">{job.error}</pre>
            </div>
          )}

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-steel-muted">payload</div>
            <pre className="max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-steel-muted">
              {JSON.stringify(job.payload ?? {}, null, 2)}
            </pre>
          </div>

          <div>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-steel-muted">execution history</div>
            <div className="space-y-3">
              {(job.history ?? []).map((h) => (
                <div key={h.attempt} className="relative border-l border-white/10 pl-4">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-ember" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-steel">attempt {h.attempt}</span>
                    <StatusPill status={h.status} />
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-steel-muted">
                    {h.workerId ?? "—"} · started {relTime(h.startedAt)}
                    {h.finishedAt ? ` · finished ${relTime(h.finishedAt)}` : ""}
                  </div>
                  {h.error && <div className="mt-1 font-mono text-[11px] text-crimson-fail">{h.error}</div>}
                </div>
              ))}
              {!(job.history ?? []).length && <p className="font-mono text-xs text-steel-muted">No attempts yet.</p>}
            </div>
          </div>

          {active && (
            <div className="flex gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => retry.mutate()}
                disabled={retry.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-4 py-2.5 text-sm text-ember transition hover:bg-ember/20 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> Retry
              </button>
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-steel-muted transition hover:border-crimson-fail/40 hover:text-crimson-fail disabled:opacity-50"
              >
                <Ban className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-steel-muted">{label}</div>
      <div className="truncate text-steel">{value}</div>
    </div>
  );
}