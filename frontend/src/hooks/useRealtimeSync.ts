import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { joinRoom, onRealtime } from "@/lib/socket";
import { useOrgProject } from "@/context/OrgProjectProvider";
import type {
  QueueStatsUpdatedEvent,
  Worker,
  WorkerHeartbeatEvent,
  WorkerStatusChangedEvent,
} from "@/lib/types";

/**
 * App-level realtime → React Query cache bridge. Server events patch the
 * cache directly instead of polling. Mounted once inside the app shell.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { projectId } = useOrgProject();

  // Join / leave the active project room
  useEffect(() => {
    if (!projectId) return;
    return joinRoom("project", projectId);
  }, [projectId]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onRealtime("job:status_changed", () => {
        qc.invalidateQueries({ queryKey: ["jobs"] });
        qc.invalidateQueries({ queryKey: ["queue-stats"] });
        qc.invalidateQueries({ queryKey: ["dlq"] });
      }),
    );

    unsubs.push(
      onRealtime<QueueStatsUpdatedEvent>("queue:stats_updated", (evt) => {
        qc.setQueryData(["queue-stats", evt.queueId], evt.stats);
        qc.invalidateQueries({ queryKey: ["queues"] });
      }),
    );

    const patchWorker = (id: string, patch: Partial<Worker>) => {
      qc.setQueryData<Worker[]>(["workers"], (prev) =>
        prev ? prev.map((w) => (w.id === id ? { ...w, ...patch } : w)) : prev,
      );
    };

    unsubs.push(
      onRealtime<WorkerHeartbeatEvent>("worker:heartbeat", (evt) => {
        patchWorker(evt.workerId, {
          currentLoad: evt.load,
          activeJobs: evt.activeJobs,
          lastHeartbeatAt: evt.at,
        });
      }),
    );

    unsubs.push(
      onRealtime<WorkerStatusChangedEvent>("worker:status_changed", (evt) => {
        patchWorker(evt.workerId, { status: evt.status });
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [qc]);
}