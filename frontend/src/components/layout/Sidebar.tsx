import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListTree,
  Search,
  Trash2,
  Cpu,
  CalendarClock,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgProjectSwitcher } from "./OrgProjectSwitcher";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/queues", label: "Production Lines", icon: ListTree },
  { to: "/jobs", label: "Job Explorer", icon: Search },
  { to: "/dlq", label: "Scrap Bin", icon: Trash2 },
  { to: "/workers", label: "Worker Fleet", icon: Cpu },
  { to: "/scheduled", label: "Scheduled", icon: CalendarClock },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="glass-deep flex h-full w-72 shrink-0 flex-col gap-6 p-4">
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember to-ember-soft">
          <div className="absolute inset-0 rounded-xl bg-ember/40 blur-md" />
          <Flame className="relative h-5 w-5 text-[#140a06]" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold leading-none text-steel">Forgeline</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-steel-muted">control deck</div>
        </div>
      </div>

      <OrgProjectSwitcher />

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                isActive ? "text-steel" : "text-steel-muted hover:text-steel",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 -z-10 rounded-xl border border-ember/30 bg-gradient-to-r from-ember/15 to-transparent" />
                )}
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] transition",
                    isActive ? "text-ember" : "text-steel-muted group-hover:text-steel",
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 font-mono text-[10px] text-steel-muted">
        <span className="text-cyan-flow">●</span> realtime link active
      </div>
    </aside>
  );
}