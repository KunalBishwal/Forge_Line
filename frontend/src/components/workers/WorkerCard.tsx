import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Activity } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LoadBar } from "@/components/ui/LoadBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { relTime, pct } from "@/lib/format";
import type { Worker } from "@/lib/types";

export function WorkerCard({ worker }: { worker: Worker }) {
  const online = worker.status !== "offline";
  return (
    <GlassPanel interactive className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
            <Cpu className="h-5 w-5 text-steel" />
            {/* heartbeat pulse — keyed to the real lastHeartbeatAt timestamp */}
            {online && (
              <AnimatePresence>
                <motion.span
                  key={worker.lastHeartbeatAt}
                  initial={{ scale: 0.6, opacity: 0.7 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="absolute inset-0 rounded-xl border border-cyan-flow"
                />
              </AnimatePresence>
            )}
          </div>
          <div>
            <div className="font-display text-base text-steel">{worker.name}</div>
            <div className="font-mono text-[11px] text-steel-muted">{worker.id}</div>
          </div>
        </div>
        <StatusPill status={worker.status} kind="worker" />
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-steel-muted">
            <span>load</span>
            <span className={worker.currentLoad > 0.85 ? "text-crimson-fail" : "text-steel"}>
              {pct(worker.currentLoad)}
            </span>
          </div>
          <LoadBar value={worker.currentLoad} />
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            <div className="text-steel-muted">jobs</div>
            <div className="text-steel">
              {worker.activeJobs}/{worker.concurrency}
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            <div className="text-steel-muted">region</div>
            <div className="text-steel">{worker.region ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            <div className="text-steel-muted">ver</div>
            <div className="text-steel">{worker.version ?? "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-steel-muted">
          <Activity className="h-3 w-3 text-cyan-flow" />
          heartbeat {relTime(worker.lastHeartbeatAt)}
        </div>
      </div>
    </GlassPanel>
  );
}