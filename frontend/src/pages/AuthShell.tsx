import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import type { ReactNode } from "react";
import { AmbientGlow } from "@/components/background/AmbientGlow";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <AmbientGlow />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-deep w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ember to-ember-soft">
            <div className="absolute inset-0 rounded-xl bg-ember/40 blur-md" />
            <Flame className="relative h-6 w-6 text-[#140a06]" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold text-steel">Forgeline</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-steel-muted">control deck</div>
          </div>
        </div>
        <h1 className="font-display text-2xl text-steel">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-steel-muted">{subtitle}</p>
        {children}
      </motion.div>
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-steel-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-steel outline-none transition placeholder:text-steel-muted/60 focus:border-ember/50"
      />
    </label>
  );
}
