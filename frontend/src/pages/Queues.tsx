import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ListTree, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LoadBar } from "@/components/ui/LoadBar";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "./AuthShell";
import { Topbar } from "@/components/layout/Topbar";
import { useOrgProject } from "@/context/OrgProjectProvider";
import * as api from "@/lib/api";

export default function Queues() {
  const { projectId } = useOrgProject();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [concurrency, setConcurrency] = useState(8);

  const q = useQuery({ queryKey: ["queues", projectId], queryFn: () => api.listQueues(projectId!), enabled: !!projectId });

  const toggle = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) => api.setQueuePaused(projectId!, id, paused),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queues", projectId] }),
    onError: () => toast.error("Action failed"),
  });
  const create = useMutation({
    mutationFn: () => api.createQueue(projectId!, { name, concurrency }),
    onSuccess: () => {
      toast.success("Production line created");
      qc.invalidateQueries({ queryKey: ["queues", projectId] });
      setOpen(false);
      setName("");
    },
    onError: () => toast.error("Could not create queue"),
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <Topbar title="Production Lines" subtitle="Queues processing your jobs" />
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-4 py-2.5 text-sm text-ember transition hover:bg-ember/20">
          <Plus className="h-4 w-4" /> New line
        </button>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      ) : q.isError ? (
        <ErrorState message="Could not load production lines." onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={ListTree} title="No production lines yet" message="Create your first queue to start moving jobs through the foundry." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((queue) => (
            <GlassPanel key={queue.id} interactive className="p-5">
              <div className="flex items-start justify-between">
                <Link to={`/queues/${queue.id}`} className="group">
                  <h3 className="font-display text-lg text-steel group-hover:text-ember">{queue.name}</h3>
                  <p className="font-mono text-[11px] text-steel-muted">{queue.id} · priority {queue.priority}</p>
                </Link>
                <button
                  onClick={() => toggle.mutate({ id: queue.id, paused: !queue.paused })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-steel-muted transition hover:text-steel"
                  aria-label={queue.paused ? "Resume" : "Pause"}
                >
                  {queue.paused ? <Play className="h-4 w-4 text-cyan-flow" /> : <Pause className="h-4 w-4 text-ember" />}
                </button>
              </div>
              <div className="mt-5">
                <div className="mb-1 flex justify-between font-mono text-[11px] text-steel-muted">
                  <span>concurrency</span>
                  <span className="text-steel">{queue.activeCount}/{queue.concurrency}{queue.paused ? " · paused" : ""}</span>
                </div>
                <LoadBar value={queue.concurrency ? queue.activeCount / queue.concurrency : 0} />
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New production line">
        <div className="space-y-4">
          <Field label="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="transcode-line" />
          <Field label="concurrency" type="number" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} />
          <button onClick={() => create.mutate()} disabled={!name || create.isPending} className="w-full rounded-xl bg-gradient-to-r from-ember to-ember-soft px-4 py-2.5 font-medium text-[#140a06] disabled:opacity-50">
            {create.isPending ? "Creating…" : "Create line"}
          </button>
        </div>
      </Modal>
    </>
  );
}
