import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthProvider";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Queues from "@/pages/Queues";
import QueueDetail from "@/pages/QueueDetail";
import JobExplorer from "@/pages/JobExplorer";
import Dlq from "@/pages/Dlq";
import Workers from "@/pages/Workers";
import ScheduledJobs from "@/pages/ScheduledJobs";
import NotFound from "@/pages/NotFound";

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center bg-void text-steel-muted">Warming the forge…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/queues" element={<Queues />} />
        <Route path="/queues/:queueId" element={<QueueDetail />} />
        <Route path="/jobs" element={<JobExplorer />} />
        <Route path="/dlq" element={<Dlq />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/scheduled" element={<ScheduledJobs />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
