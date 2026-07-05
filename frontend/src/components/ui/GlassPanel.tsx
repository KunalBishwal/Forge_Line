import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  deep?: boolean;
  interactive?: boolean;
}

/**
 * Layered glass surface. `interactive` adds an ember→cyan gradient border-glow
 * on hover for stacking depth.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, deep, interactive, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative isolate",
          deep ? "glass-deep" : "glass",
          interactive &&
            "group/glass transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_80px_-20px_rgba(0,0,0,0.9)]",
          className,
        )}
        {...props}
      >
        {interactive && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-px -z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/glass:opacity-100"
            style={{
              background:
                "linear-gradient(120deg, rgba(255,122,69,0.55), rgba(76,219,255,0.55))",
              filter: "blur(10px)",
            }}
          />
        )}
        {children}
      </div>
    );
  },
);
GlassPanel.displayName = "GlassPanel";