import { motion } from "framer-motion";
import { StatusPill } from "@/components/ui/StatusPill";
import { relTime, shortId } from "@/lib/format";
import type { Job } from "@/lib/types";

export function JobsTable({ jobs, onSelect }: { jobs: Job[]; onSelect: (job: Job) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 font-mono text-[11px] uppercase tracking-wider text-steel-muted">
            <th className="px-4 py-3 font-medium">Job ID</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Line</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Prio</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Attempts</th>
            <th className="px-4 py-3 text-right font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <motion.tr
              key={job.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.015, 0.3) }}
              onClick={() => onSelect(job)}
              className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 font-mono text-xs text-cyan-flow">{shortId(job.id)}</td>
              <td className="px-4 py-3 text-sm text-steel">{job.type}</td>
              <td className="hidden px-4 py-3 font-mono text-xs text-steel-muted md:table-cell">{job.queueName}</td>
              <td className="px-4 py-3">
                <StatusPill status={job.status} />
              </td>
              <td className="hidden px-4 py-3 font-mono text-sm text-steel sm:table-cell">{job.priority}</td>
              <td className="hidden px-4 py-3 font-mono text-sm text-steel-muted sm:table-cell">
                {job.attempts}/{job.maxAttempts}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[11px] text-steel-muted">{relTime(job.updatedAt)}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}