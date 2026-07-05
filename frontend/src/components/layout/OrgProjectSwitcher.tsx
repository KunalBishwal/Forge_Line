import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { useState } from "react";
import { useOrgProject } from "@/context/OrgProjectProvider";
import { cn } from "@/lib/utils";

export function OrgProjectSwitcher() {
  const { orgs, projects, org, project, setOrgId, setProjectId } = useOrgProject();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glow-border flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-ember/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ember/30 to-cyan-flow/30">
          <FolderKanban className="h-4 w-4 text-steel" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-steel">{project?.name ?? "Select project"}</div>
          <div className="truncate font-mono text-[11px] text-steel-muted">{org?.name ?? "—"}</div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-steel-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="glass-deep absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto p-2"
              role="listbox"
            >
              {orgs.map((o) => (
                <div key={o.id} className="mb-2">
                  <button
                    onClick={() => setOrgId(o.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs uppercase tracking-wider text-steel-muted transition hover:text-steel"
                  >
                    {o.name}
                    {org?.id === o.id && <Check className="h-3.5 w-3.5 text-ember" />}
                  </button>
                  {org?.id === o.id &&
                    projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProjectId(p.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5",
                          project?.id === p.id ? "text-steel" : "text-steel-muted",
                        )}
                      >
                        <span className="truncate">{p.name}</span>
                        {project?.id === p.id && <Check className="h-4 w-4 text-cyan-flow" />}
                      </button>
                    ))}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}