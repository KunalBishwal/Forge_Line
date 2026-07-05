import { LogOut, Radio } from "lucide-react";
import { useOrgProject } from "@/context/OrgProjectProvider";
import { useAuth } from "@/context/AuthProvider";
import { isMockMode } from "@/lib/config";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { project } = useOrgProject();
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-steel">{title}</h1>
        <p className="mt-0.5 font-mono text-xs text-steel-muted">
          {subtitle ?? (project ? `${project.name} · ${project.id}` : "no project selected")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {isMockMode() && (
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-flow/30 bg-cyan-flow/10 px-3 py-1 font-mono text-[11px] text-cyan-flow">
            <Radio className="h-3 w-3" /> demo data
          </span>
        )}
        <div className="hidden text-right sm:block">
          <div className="text-sm text-steel">{user?.name ?? "Operator"}</div>
          <div className="font-mono text-[11px] text-steel-muted">{user?.email}</div>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-steel-muted transition hover:border-crimson-fail/40 hover:text-crimson-fail"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}