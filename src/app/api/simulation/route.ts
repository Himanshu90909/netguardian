import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { adjacency, reachableFrom, DeviceRow, LinkRow } from "@/lib/network";

// Failure/recovery simulation over the modeled topology.
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; scenario?: string; device_id?: number; link_id?: number }>(req);
  if (!b.project_id || !b.scenario) throw new HttpError(400, "project_id and scenario are required");
  await guardProject(userId, b.project_id);
  const scenarios = ["device_failure", "device_recovery", "link_failure", "link_recovery", "router_failure", "switch_failure", "high_latency", "packet_loss", "bandwidth_spike"];
  if (!scenarios.includes(b.scenario)) throw new HttpError(400, `scenario must be one of: ${scenarios.join(", ")}`);

  const allDevices = await query<DeviceRow>(`SELECT * FROM netguardian.devices WHERE project_id = $1`, [b.project_id]);
  const allLinks = await query<LinkRow>(`SELECT * FROM netguardian.topology_links WHERE project_id = $1`, [b.project_id]);

  async function addLog(deviceId: number | null, type: string, message: string) {
    await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,$3,$4)`, [b.project_id, deviceId, type, message]);
  }
  async function addAlert(deviceId: number | null, type: string, severity: string, message: string) {
    await query(`INSERT INTO netguardian.alerts (project_id, device_id, alert_type, severity, message) VALUES ($1,$2,$3,$4,$5)`, [b.project_id, deviceId, type, severity, message]);
  }

  if (b.scenario === "device_failure" || b.scenario === "router_failure" || b.scenario === "switch_failure") {
    let device: DeviceRow | undefined;
    if (b.device_id) device = allDevices.find((d) => d.id === b.device_id);
    else {
      const wantType = b.scenario === "router_failure" ? "Router" : "Layer 2 Switch";
      device = allDevices.find((d) => d.device_type === wantType && d.status === "online");
      if (!device) device = allDevices.find((d) => d.status === "online");
    }
    if (!device) throw new HttpError(400, "No online device available for this scenario");
    await query(`UPDATE netguardian.devices SET status = 'offline' WHERE id = $1`, [device.id]);
    await query(`UPDATE netguardian.interfaces SET status = 'down' WHERE device_id = $1`, [device.id]);
    await query(`UPDATE netguardian.topology_links SET status = 'down' WHERE source_device = $1 OR destination_device = $1`, [device.id]);
    const devicesAfter = allDevices.map((d) => (d.id === device!.id ? { ...d, status: "offline" } : d));
    const linksAfter = allLinks.map((l) => (l.source_device === device!.id || l.destination_device === device!.id ? { ...l, status: "down" } : l));
    const adj = adjacency(devicesAfter, linksAfter);
    const coreSwitch = devicesAfter.find((d) => d.device_type.includes("Switch")) ?? devicesAfter.find((d) => d.device_type === "Router");
    const impacted = coreSwitch ? allDevices.filter((d) => d.status === "online" && !reachableFrom(adj, coreSwitch.id).has(d.id)).map((d) => d.name) : [];
    await addLog(device.id, "failure", `${device.name} went DOWN — device failure simulated.`);
    await addAlert(device.id, b.scenario === "router_failure" ? "device_failure" : b.scenario, "critical", `${device.name} is unreachable.`);
    return NextResponse.json({
      ok: true, scenario: b.scenario, device: device.name,
      impactedDevices: impacted,
      message: `${device.name} marked offline; attached links set to down; connectivity recalculated over the remaining topology.`,
      note: "Topology status, event log and alerts were updated in the database. Alternate-path selection is demonstrated conceptually on the Routing page.",
    });
  }

  if (b.scenario === "device_recovery") {
    const off = b.device_id ? allDevices.find((d) => d.id === b.device_id) : allDevices.find((d) => d.status === "offline");
    if (!off || off.status !== "offline") throw new HttpError(400, "No offline device to recover");
    await query(`UPDATE netguardian.devices SET status = 'online' WHERE id = $1`, [off.id]);
    await query(`UPDATE netguardian.interfaces SET status = 'up' WHERE device_id = $1`, [off.id]);
    await query(`UPDATE netguardian.topology_links SET status = 'up' WHERE (source_device = $1 OR destination_device = $1) AND status = 'down'`, [off.id]);
    await addLog(off.id, "recovery", `${off.name} recovered — all interfaces back UP, connectivity restored.`);
    await query(`UPDATE netguardian.alerts SET status = 'resolved', resolved_at = now() WHERE device_id = $1 AND status = 'active'`, [off.id]);
    return NextResponse.json({ ok: true, scenario: "device_recovery", device: off.name, impactedDevices: [], message: `${off.name} is online again; related active alerts auto-resolved.` });
  }

  if (b.scenario === "link_failure" || b.scenario === "link_recovery") {
    if (!b.link_id) throw new HttpError(400, "link_id is required");
    const link = allLinks.find((l) => l.id === b.link_id);
    if (!link) throw new HttpError(404, "Link not found");
    const newStatus = b.scenario === "link_failure" ? "down" : "up";
    await query(`UPDATE netguardian.topology_links SET status = $2 WHERE id = $1`, [link.id, newStatus]);
    const names = await query(`SELECT name FROM netguardian.devices WHERE id IN ($1,$2)`, [link.source_device, link.destination_device]);
    await addLog(link.source_device, "link", `Link ${names[0]?.name} ↔ ${names[1]?.name} status changed to ${newStatus} (simulated).`);
    if (newStatus === "down") await addAlert(link.source_device, "link_failure", "high", `Link down: ${names[0]?.name} ↔ ${names[1]?.name}.`);
    return NextResponse.json({ ok: true, scenario: b.scenario, message: `Link ${names[0]?.name} ↔ ${names[1]?.name} is now ${newStatus}.` });
  }

  // Metric scenarios: append a fresh telemetry cycle with the injected condition
  await fetch(`${new URL(req.url).origin}/api/metrics`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: b.project_id, scenario: b.scenario }),
  }).catch(() => null);
  const label = b.scenario === "high_latency" ? "High latency" : b.scenario === "packet_loss" ? "Packet loss" : "Bandwidth spike";
  await addLog(b.device_id ?? null, "simulation", `${label} scenario injected into the next simulated telemetry cycle.`);
  if (b.scenario === "bandwidth_spike" || b.scenario === "high_latency")
    await addAlert(b.device_id ?? null, b.scenario, "high", `${label} simulated across affected devices — anomaly detection will flag deviations.`);
  return NextResponse.json({ ok: true, scenario: b.scenario, message: `${label} injected into fresh simulated metrics. Run Anomaly Detection to see the flagged deviations.` });
});
