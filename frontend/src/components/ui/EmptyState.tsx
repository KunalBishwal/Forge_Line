import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-col items-center justify-center gap-3 px-8 py-16 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-ember/20 blur-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <Icon className="h-7 w-7 text-ember" />
        </div>
      </div>
      <h3 className="font-display text-lg text-steel">{title}</h3>
      <p className="max-w-sm text-sm text-steel-muted">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-crimson-fail/30 bg-crimson-fail/10">
        <span className="text-2xl">⚠</span>
      </div>
      <h3 className="font-display text-lg text-steel">Signal lost</h3>
      <p className="max-w-sm text-sm text-steel-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-steel transition hover:border-ember/40 hover:text-ember"
        >
          Retry
        </button>
      )}
    </div>
  );
}