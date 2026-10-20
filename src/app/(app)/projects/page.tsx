"use client";
import { useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty } from "@/components/ui";
import { post, del, api } from "@/lib/client";

export default function Projects() {
  const { projects, project, setProject, refreshProjects, seedSample } = useProject();
  const [form, setForm] = useState({ name: "", description: "", network_type: "Enterprise LAN" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const TYPES = ["Enterprise LAN", "Campus Network", "Data Center Network", "Hospital Network", "Branch Office WAN", "Home Lab"];

  async function create() {
    try {
      const r = await post("/projects", form);
      setForm({ name: "", description: "", network_type: "Enterprise LAN" }); setErr("");
      await refreshProjects();
      const p = (await api<{ projects: typeof projects }>("/projects")).projects.find((x) => x.id === r.id);
      if (p) setProject(p);
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Projects</h1>
      <Card title="Create project">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <input className="input" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.network_type} onChange={(e) => setForm({ ...form, network_type: e.target.value })}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className="btn-solid" disabled={!form.name} onClick={create}>Create</button>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      </Card>

      {projects.length === 0 ? (
        <Card>
          <Empty title="No projects yet" hint="Create one above, or load the sample Smart Campus network." />
          <div className="text-center"><button className="btn-solid" disabled={busy} onClick={async () => { setBusy(true); await seedSample().catch(() => null); setBusy(false); }}>
            {busy ? "Creating sample…" : "Load sample: Smart Campus Enterprise Network"}
          </button></div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className={project?.id === p.id ? "!border-noc-accent/40" : ""}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.network_type}</p>
                </div>
                {p.is_sample && <Badge tone="info">sample · simulated</Badge>}
              </div>
              <p className="text-xs text-slate-400 mt-2">{p.description ?? "No description."}</p>
              <p className="text-[10px] text-slate-600 mt-2">Created {new Date(p.created_at).toLocaleDateString()}</p>
              <div className="flex gap-2 mt-3">
                <button className="btn" onClick={() => setProject(p)}>{project?.id === p.id ? "Active ✓" : "Activate"}</button>
                <button className="text-xs text-red-400 hover:underline self-center" onClick={async () => { if (confirm(`Delete project "${p.name}" and all its data?`)) { await del(`/projects/${p.id}`); await refreshProjects(); } }}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
