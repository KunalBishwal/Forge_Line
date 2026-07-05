# Forgeline — Web

Frontend control deck for the Forgeline distributed job scheduling platform.
Standalone **Vite + React + TypeScript** SPA — drop this folder in as `apps/web`.

## Stack
React · React Router · TanStack Query · socket.io-client · three.js /
@react-three/fiber / drei · Framer Motion · GSAP · Recharts · Tailwind CSS v4.

## Setup
```bash
cp .env.example .env      # set VITE_API_URL / VITE_SOCKET_URL
bun install               # or npm install
bun run dev               # http://localhost:8080
```

## Environment
| var | purpose |
| --- | --- |
| `VITE_API_URL` | REST base URL (default `http://localhost:3000`) |
| `VITE_SOCKET_URL` | Socket.io URL (defaults to `VITE_API_URL`) |
| `VITE_USE_MOCKS` | `true` = always demo data, `false` = always real API, empty = auto |

## Demo / mock mode
When no backend is reachable (or `VITE_USE_MOCKS=true`), the app serves seeded
data and a simulated Socket.io stream so every page, the 3D pipeline hero, live
load bars and worker heartbeats animate without a running backend. Point
`VITE_API_URL` at a live Forgeline API and set `VITE_USE_MOCKS=false` to use it.

## Structure
```
src/
  pages/        route screens
  components/   ui/ layout/ background/ dashboard/ workers/ jobs/
  context/      AuthProvider, OrgProjectProvider
  hooks/        realtime sync, job events, reduced motion
  lib/          api.ts, socket.ts, types.ts, mocks/
```

## Realtime
`lib/socket.ts` abstracts Socket.io. The app joins `project`/`queue` rooms and
patches the TanStack Query cache from `job:status_changed`,
`queue:stats_updated`, `worker:heartbeat`, and `worker:status_changed` events —
no polling. Respects `prefers-reduced-motion` throughout.
