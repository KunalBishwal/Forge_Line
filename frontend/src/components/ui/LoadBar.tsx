import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function LoadBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const color =
    v > 0.85 ? "from-crimson-fail to-ember" : v > 0.55 ? "from-ember to-ember-soft" : "from-cyan-flow to-cyan-flow";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-gradient-to-r", color)}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        style={{ boxShadow: "0 0 12px rgba(255,122,69,0.4)" }}
      />
    </div>
  );
}