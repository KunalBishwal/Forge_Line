import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Layered animated glow blobs + faint grid behind the glass layer. */
export function AmbientGlow() {
  const reduced = useReducedMotion();
  const anim = reduced ? "" : "animate-[forge-blob_18s_ease-in-out_infinite]";
  const anim2 = reduced ? "" : "animate-[forge-blob_24s_ease-in-out_infinite]";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div
        className={`absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full blur-[120px] ${anim}`}
        style={{ background: "radial-gradient(circle, rgba(255,122,69,0.22), transparent 65%)" }}
      />
      <div
        className={`absolute -right-40 top-1/4 h-[40rem] w-[40rem] rounded-full blur-[130px] ${anim2}`}
        style={{ background: "radial-gradient(circle, rgba(76,219,255,0.18), transparent 65%)" }}
      />
      <div
        className={`absolute bottom-[-20rem] left-1/3 h-[38rem] w-[38rem] rounded-full blur-[140px] ${anim}`}
        style={{ background: "radial-gradient(circle, rgba(255,122,69,0.12), transparent 65%)" }}
      />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(10,9,18,0.6) 100%)" }} />
    </div>
  );
}