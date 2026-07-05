import { useEffect, useRef, useState } from "react";
import { onRealtime } from "@/lib/socket";
import type { JobStatusChangedEvent } from "@/lib/types";

/**
 * Streams job:status_changed events. Keeps a rolling buffer for consumers
 * (e.g. the 3D pipeline hero) that animate on each transition.
 */
export function useJobEvents(limit = 40) {
  const [events, setEvents] = useState<JobStatusChangedEvent[]>([]);
  const latest = useRef<JobStatusChangedEvent | null>(null);

  useEffect(() => {
    return onRealtime<JobStatusChangedEvent>("job:status_changed", (evt) => {
      latest.current = evt;
      setEvents((prev) => [...prev.slice(-(limit - 1)), evt]);
    });
  }, [limit]);

  return { events, latest };
}