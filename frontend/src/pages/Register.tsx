import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { AuthShell, Field } from "./AuthShell";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(email, password, name);
      nav("/", { replace: true });
    } catch {
      toast.error("Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forge your account" subtitle="Spin up a new Forgeline operator.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
        <Field label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-ember to-ember-soft px-4 py-2.5 font-medium text-[#140a06] transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Forging…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-steel-muted">
        Already registered?{" "}
        <Link to="/login" className="text-cyan-flow hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
