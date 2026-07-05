import { useQuery } from "@tanstack/react-query";
import { CpuIcon } from "lucide-react";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { WorkerCard } from "@/components/workers/WorkerCard";
import { Topbar } from "@/components/layout/Topbar";
import * as api from "@/lib/api";

export default function Workers() {
  const workers = useQuery({ queryKey: ["workers"], queryFn: api.listWorkers });
  return (
    <>
      <Topbar title="Worker Fleet" subtitle="Live worker nodes and heartbeats" />
      {workers.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : workers.isError ? (
        <ErrorState message="Could not reach the worker fleet." onRetry={() => workers.refetch()} />
      ) : !workers.data?.length ? (
        <EmptyState icon={CpuIcon} title="No workers online" message="Spin up a worker node to start processing jobs." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workers.data.map((w) => <WorkerCard key={w.id} worker={w} />)}
        </div>
      )}
    </>
  );
}
