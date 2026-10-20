import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { adjacency, bfsPath, deviceById, simPing, simTraceroute } from "@/lib/network";
import dns from "dns/promises";
import net from "net";

// Controlled educational diagnostics:
//  - Ping / Traceroute are SIMULATED over the modeled topology (labeled as such).
//  - DNS Lookup and Port Check perform REAL network queries from the server.
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; tool?: string; source_device?: number; target?: string; port?: number; record_type?: string }>(req);
  if (!b.project_id || !b.tool) throw new HttpError(400, "project_id and tool are required");
  await guardProject(userId, b.project_id);

  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1`, [b.project_id]);
  const links = await query(`SELECT * FROM netguardian.topology_links WHERE project_id = $1`, [b.project_id]);

  if (b.tool === "ping" || b.tool === "traceroute") {
    if (!b.source_device || !b.target) throw new HttpError(400, "source_device and target are required");
    const src = deviceById(devices, b.source_device);
    if (!src) throw new HttpError(404, "Source device not found");
    const dst = devices.find((d) => d.ip_address === b.target) ?? devices.find((d) => d.name.toLowerCase() === (b.target ?? "").toLowerCase());
    const adj = adjacency(devices, links);
    if (src.status === "offline") throw new HttpError(400, `${src.name} is offline — bring it online before running diagnostics.`);
    if (!dst) throw new HttpError(404, `No device with IP or name "${b.target}" exists in this project's topology.`);
    const path = bfsPath(adj, src.id, dst.id);
    const result = b.tool === "ping"
      ? simPing(path, devices, dst.ip_address ?? "")
      : simTraceroute(path, devices, dst.ip_address ?? "");
    await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'diagnostic',$3)`,
      [b.project_id, src.id, `${b.tool === "ping" ? "Ping" : "Traceroute"} from ${src.name} to ${dst.name} (${dst.ip_address}) — ${result.reachable ? "reachable" : "unreachable"} (simulated).`]);
    return NextResponse.json({ tool: b.tool, result, path: path?.map((id) => deviceById(devices, id)?.name) });
  }

  if (b.tool === "dns") {
    if (!b.target) throw new HttpError(400, "Domain name is required");
    const domain = b.target.trim();
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) throw new HttpError(400, "Invalid domain name");
    try {
      const type = (b.record_type ?? "A").toUpperCase() as any;
      let records: string[] = [];
      let status = "NOERROR";
      try {
        const r = await dns.resolve(domain, type as any);
        records = Array.isArray(r) ? r.map(String) : [String(r)];
      } catch (e: any) {
        status = e.code ?? "RESOLVE_FAILED";
      }
      const answer = records.length ? records : ["No records found"];
      await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'dns',$2)`,
        [b.project_id, `DNS lookup for ${domain} (${type}) — status ${status}.`]);
      return NextResponse.json({ tool: "dns", result: { domain, recordType: type, records: answer, status, real: true } });
    } catch (e: any) { throw new HttpError(400, `DNS lookup failed: ${e.message}`); }
  }

  if (b.tool === "port") {
    if (!b.target) throw new HttpError(400, "Host is required");
    const host = b.target.trim();
    const PORTS: [number, string][] = [[21, "FTP"], [22, "SSH"], [25, "SMTP"], [53, "DNS"], [80, "HTTP"], [443, "HTTPS"]];
    const results = await Promise.all(PORTS.map(async ([port, svc]) => {
      const open = await new Promise<boolean>((resolve) => {
        const s = new net.Socket();
        const t = setTimeout(() => { s.destroy(); resolve(false); }, 3000);
        s.connect(port, host, () => { clearTimeout(t); s.destroy(); resolve(true); });
        s.on("error", () => { clearTimeout(t); resolve(false); });
      });
      return { port, service: svc, open };
    }));
    await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'diagnostic',$2)`,
      [b.project_id, `Port scan completed against ${host} (common ports 21-443).`]);
    return NextResponse.json({ tool: "port", result: { host, ports: results, real: true, note: "Real TCP connect check from the server (controlled educational check of common ports only)." } });
  }

  throw new HttpError(400, "tool must be ping, traceroute, dns or port");
});
