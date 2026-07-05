import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { JobStatus, WorkerStatus } from "@/lib/types";

const JOB_STYLES: Record<JobStatus, { label: string; cls: string; dot: string }> = {
  queued: { label: "Queued", cls: "text-steel-muted border-white/10 bg-white/[0.03]", dot: "bg-steel-muted" },
  claimed: { label: "Claimed", cls: "text-cyan-flow border-cyan-flow/30 bg-cyan-flow/10", dot: "bg-cyan-flow" },
  running: { label: "Running", cls: "text-ember border-ember/30 bg-ember/10", dot: "bg-ember" },
  completed: { label: "Completed", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-400" },
  failed: { label: "Failed", cls: "text-crimson-fail border-crimson-fail/30 bg-crimson-fail/10", dot: "bg-crimson-fail" },
  dead_letter: { label: "Dead Letter", cls: "text-crimson-fail border-crimson-fail/40 bg-crimson-fail/15", dot: "bg-crimson-fail" },
  cancelled: { label: "Cancelled", cls: "text-steel-muted border-white/10 bg-white/[0.03]", dot: "bg-steel-muted" },
};

const WORKER_STYLES: Record<WorkerStatus, { label: string; cls: string; dot: string }> = {
  online: { label: "Online", cls: "text-cyan-flow border-cyan-flow/30 bg-cyan-flow/10", dot: "bg-cyan-flow" },
  idle: { label: "Idle", cls: "text-steel-muted border-white/10 bg-white/[0.03]", dot: "bg-steel-muted" },
  busy: { label: "Busy", cls: "text-ember border-ember/30 bg-ember/10", dot: "bg-ember" },
  offline: { label: "Offline", cls: "text-crimson-fail border-crimson-fail/30 bg-crimson-fail/10", dot: "bg-crimson-fail" },
};

export function StatusPill({ status, kind = "job" }: { status: JobStatus | WorkerStatus; kind?: "job" | "worker" }) {
  const s = kind === "worker" ? WORKER_STYLES[status as WorkerStatus] : JOB_STYLES[status as JobStatus];
  if (!s) return null;
  return (
    <motion.span
      layout
      initial={false}
      animate={{ opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide",
        s.cls,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </motion.span>
  );
}