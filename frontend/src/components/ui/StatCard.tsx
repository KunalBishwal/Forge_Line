import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { GlassPanel } from "./GlassPanel";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "ember",
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "ember" | "cyan" | "crimson" | "emerald";
  hint?: string;
}) {
  const accents: Record<string, string> = {
    ember: "text-ember",
    cyan: "text-cyan-flow",
    crimson: "text-crimson-fail",
    emerald: "text-emerald-300",
  };
  const glow: Record<string, string> = {
    ember: "bg-ember/20",
    cyan: "bg-cyan-flow/20",
    crimson: "bg-crimson-fail/20",
    emerald: "bg-emerald-400/20",
  };
  return (
    <GlassPanel interactive className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider text-steel-muted">{label}</span>
        <div className="relative">
          <div className={cn("absolute inset-0 -z-10 rounded-full blur-xl", glow[accent])} />
          <Icon className={cn("h-5 w-5", accents[accent])} />
        </div>
      </div>
      <motion.div className="mt-3 font-display text-4xl font-semibold text-steel">
        <CountUp value={value} />
      </motion.div>
      {hint && <p className="mt-1 font-mono text-[11px] text-steel-muted">{hint}</p>}
    </GlassPanel>
  );
}