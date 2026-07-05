import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { AuthShell, Field } from "./AuthShell";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: { pathname?: string } } };
  const [email, setEmail] = useState("demo@forgeline.dev");
  const [password, setPassword] = useState("forgeline123");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from?.pathname ?? "/", { replace: true });
    } catch {
      toast.error("Login failed — check your credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Enter the control deck" subtitle="Sign in to monitor your pipelines.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-ember to-ember-soft px-4 py-2.5 font-medium text-[#140a06] transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Igniting…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-steel-muted">
        No account?{" "}
        <Link to="/register" className="text-cyan-flow hover:underline">
          Forge one
        </Link>
      </p>
    </AuthShell>
  );
}
