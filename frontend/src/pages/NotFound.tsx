import { Link } from "react-router-dom";
import { AmbientGlow } from "@/components/background/AmbientGlow";

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 text-center">
      <AmbientGlow />
      <div>
        <div className="font-display text-7xl font-bold text-ember text-glow-ember">404</div>
        <p className="mt-3 text-steel-muted">This deck panel doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-steel transition hover:border-ember/40 hover:text-ember">
          Back to control deck
        </Link>
      </div>
    </div>
  );
}
