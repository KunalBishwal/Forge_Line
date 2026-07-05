import { io, type Socket } from "socket.io-client";
import { SOCKET_URL, TOKEN_KEY, isMockMode } from "./config";
import { mockEmitter } from "./mocks/emitter";

export type RealtimeEvent =
  | "job:status_changed"
  | "queue:stats_updated"
  | "worker:heartbeat"
  | "worker:status_changed";

export type RoomKind = "project" | "queue";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      auth: { token: localStorage.getItem(TOKEN_KEY) },
    });
  }
  return socket;
}

/** Subscribe to a realtime event. Returns an unsubscribe function. */
export function onRealtime<T = unknown>(event: RealtimeEvent, cb: (payload: T) => void): () => void {
  if (isMockMode()) {
    return mockEmitter.on(event, cb as (p: unknown) => void);
  }
  const s = getSocket();
  const handler = (payload: T) => cb(payload);
  s.on(event, handler);
  return () => s.off(event, handler);
}

/** Join a project or queue room to receive scoped events. Returns a leave fn. */
export function joinRoom(kind: RoomKind, id: string): () => void {
  if (isMockMode() || !id) return () => {};
  const s = getSocket();
  s.emit(`join:${kind}`, { id });
  return () => s.emit(`leave:${kind}`, { id });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (isMockMode()) mockEmitter.stop();
}