import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { onRealtime } from "@/lib/socket";
import type { JobStatusChangedEvent } from "@/lib/types";

const STAGES = [
  { key: "queued", label: "Queued", color: "#8b879c" },
  { key: "claimed", label: "Claimed", color: "#4cdbff" },
  { key: "running", label: "Running", color: "#ff7a45" },
  { key: "completed", label: "Completed", color: "#5eead4" },
  { key: "dead_letter", label: "Dead Letter", color: "#ff4d5e" },
];

export function Pipeline2DStrip() {
  const [pulse, setPulse] = useState<Record<string, number>>({});

  useEffect(() => {
    return onRealtime<JobStatusChangedEvent>("job:status_changed", (evt) => {
      setPulse((p) => ({ ...p, [evt.to]: (p[evt.to] ?? 0) + 1 }));
    });
  }, []);

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto py-6">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="relative flex min-w-[86px] flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4">
            <AnimatePresence>
              <motion.div
                key={pulse[s.key] ?? 0}
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 rounded-xl"
                style={{ background: s.color, opacity: 0.15 }}
              />
            </AnimatePresence>
            <span className="h-3 w-3 rounded-full" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }} />
            <span className="text-center font-mono text-[10px] uppercase tracking-wide text-steel-muted">{s.label}</span>
          </div>
          {i < STAGES.length - 1 && <div className="h-px w-4 bg-gradient-to-r from-white/20 to-transparent" />}
        </div>
      ))}
    </div>
  );
}