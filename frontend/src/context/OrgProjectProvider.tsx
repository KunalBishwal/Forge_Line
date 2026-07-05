import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { ORG_KEY, PROJECT_KEY } from "@/lib/config";
import type { Organization, Project } from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface OrgProjectCtx {
  orgs: Organization[];
  projects: Project[];
  orgId: string | null;
  projectId: string | null;
  org: Organization | null;
  project: Project | null;
  setOrgId: (id: string) => void;
  setProjectId: (id: string) => void;
  loading: boolean;
}

const Ctx = createContext<OrgProjectCtx | null>(null);

export function OrgProjectProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [orgId, setOrgIdState] = useState<string | null>(() => localStorage.getItem(ORG_KEY));
  const [projectId, setProjectIdState] = useState<string | null>(() => localStorage.getItem(PROJECT_KEY));

  const orgsQ = useQuery({
    queryKey: ["organizations"],
    queryFn: api.listOrganizations,
    enabled: isAuthenticated,
  });

  const effectiveOrg = orgId && orgsQ.data?.some((o) => o.id === orgId) ? orgId : (orgsQ.data?.[0]?.id ?? null);

  const projectsQ = useQuery({
    queryKey: ["projects", effectiveOrg],
    queryFn: () => api.listProjects(effectiveOrg!),
    enabled: isAuthenticated && !!effectiveOrg,
  });

  const effectiveProject =
    projectId && projectsQ.data?.some((p) => p.id === projectId)
      ? projectId
      : (projectsQ.data?.[0]?.id ?? null);

  // Persist + sync resolved defaults
  useEffect(() => {
    if (effectiveOrg && effectiveOrg !== orgId) {
      setOrgIdState(effectiveOrg);
      localStorage.setItem(ORG_KEY, effectiveOrg);
    }
  }, [effectiveOrg, orgId]);

  useEffect(() => {
    if (effectiveProject && effectiveProject !== projectId) {
      setProjectIdState(effectiveProject);
      localStorage.setItem(PROJECT_KEY, effectiveProject);
    }
  }, [effectiveProject, projectId]);

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    localStorage.setItem(ORG_KEY, id);
    // reset project so it re-defaults for the new org
    setProjectIdState(null);
    localStorage.removeItem(PROJECT_KEY);
  };
  const setProjectId = (id: string) => {
    setProjectIdState(id);
    localStorage.setItem(PROJECT_KEY, id);
  };

  const value = useMemo<OrgProjectCtx>(
    () => ({
      orgs: orgsQ.data ?? [],
      projects: projectsQ.data ?? [],
      orgId: effectiveOrg,
      projectId: effectiveProject,
      org: orgsQ.data?.find((o) => o.id === effectiveOrg) ?? null,
      project: projectsQ.data?.find((p) => p.id === effectiveProject) ?? null,
      setOrgId,
      setProjectId,
      loading: orgsQ.isLoading || projectsQ.isLoading,
    }),
    [orgsQ.data, projectsQ.data, effectiveOrg, effectiveProject, orgsQ.isLoading, projectsQ.isLoading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrgProject() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrgProject must be used within OrgProjectProvider");
  return ctx;
}