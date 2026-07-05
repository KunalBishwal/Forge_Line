// Runtime configuration for Forgeline frontend.

const env = import.meta.env;

export const API_URL: string = (env.VITE_API_URL as string) || "http://localhost:3000";
export const SOCKET_URL: string = (env.VITE_SOCKET_URL as string) || API_URL;

// Explicit opt-in via env, otherwise auto-enabled when no backend is reachable.
const explicitMocks = String(env.VITE_USE_MOCKS ?? "").toLowerCase();

let mockMode =
  explicitMocks === "true" || explicitMocks === "1"
    ? true
    : explicitMocks === "false" || explicitMocks === "0"
      ? false
      : null; // null = auto-detect

export function isMockMode(): boolean {
  // Default to mock when undecided (e.g. hosted preview with no backend).
  return mockMode ?? true;
}

export function setMockMode(value: boolean) {
  mockMode = value;
}

export function mockDecided(): boolean {
  return mockMode !== null;
}

// Storage keys
export const TOKEN_KEY = "forgeline.access_token";
export const REFRESH_KEY = "forgeline.refresh_token";
export const ORG_KEY = "forgeline.org_id";
export const PROJECT_KEY = "forgeline.project_id";