"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, post } from "@/lib/client";

type Project = { id: number; name: string; description: string | null; network_type: string; is_sample: boolean; created_at: string };
type Ctx = {
  projects: Project[]; project: Project | null;
  setProject: (p: Project) => void; refreshProjects: () => Promise<void>;
  loading: boolean; authed: boolean;
  seedSample: () => Promise<number>;
};
const ProjectContext = createContext<Ctx>(null as unknown as Ctx);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const authed = status === "authenticated";

  const refreshProjects = useCallback(async () => {
    if (!authed) return;
    try {
      const { projects } = await api<{ projects: Project[] }>("/projects");
      setProjects(projects);
      const stored = typeof window !== "undefined" ? Number(localStorage.getItem("ng_project")) : NaN;
      const active = projects.find((p) => p.id === stored) ?? projects[0] ?? null;
      if (active && typeof window !== "undefined") localStorage.setItem("ng_project", String(active.id));
      setProjectState(active);
    } finally { setLoading(false); }
  }, [authed]);

  useEffect(() => { if (authed) refreshProjects(); else { setProjects([]); setProjectState(null); setLoading(false); } }, [authed, refreshProjects]);

  const setProject = (p: Project) => { localStorage.setItem("ng_project", String(p.id)); setProjectState(p); };

  const seedSample = async () => {
    const { projectId } = await post<{ projectId: number }>("/seed");
    await refreshProjects();
    const created = (await api<{ projects: Project[] }>("/projects")).projects.find((p) => p.id === projectId);
    if (created) setProject(created);
    return projectId;
  };

  return (
    <ProjectContext.Provider value={{ projects, project, setProject, refreshProjects, loading, authed, seedSample }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
