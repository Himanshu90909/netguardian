// Sample project seeder — "Smart Campus Enterprise Network" (SIMULATED data, clearly labeled).
import { query } from "./db";
import { deviceBaseline, generateMetric } from "./network";

function rndMac(i: number) {
  const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `00:1B:44:${h(16 + i)}:${h(64 + i * 7)}:${h(17 + i * 13)}`;
}

export async function seedSampleProject(userId: number): Promise<number> {
  const existing = await query(`SELECT id FROM netguardian.projects WHERE user_id = $1 AND is_sample = true`, [userId]);
  if (existing[0]) return existing[0].id;

  const pr = await query<{ id: number }>(
    `INSERT INTO netguardian.projects (user_id, name, description, network_type, is_sample)
     VALUES ($1, 'Smart Campus Enterprise Network',
     'Sample enterprise campus network (SIMULATED data) — edge routing, core L3 switching, 5 VLANs, server farm, monitoring and security.',
     'Enterprise Campus', true) RETURNING id`, [userId]);
  const projectId = pr[0].id;

  type D = { name: string; type: string; ip: string; loc: string; x: number; y: number };
  const devices: D[] = [
    { name: "EDGE-RTR-01", type: "Router", ip: "203.0.113.1", loc: "Main Gate MDF", x: 50, y: 40 },
    { name: "FW-01", type: "Firewall", ip: "10.0.0.2", loc: "Main Gate MDF", x: 50, y: 110 },
    { name: "CORE-SW-01", type: "Layer 3 Switch", ip: "10.0.0.3", loc: "Main Gate MDF", x: 50, y: 180 },
    { name: "SW-BLDG-A", type: "Layer 2 Switch", ip: "10.10.1.2", loc: "Block A IDF", x: 230, y: 260 },
    { name: "SW-BLDG-B", type: "Layer 2 Switch", ip: "10.20.1.2", loc: "Block B IDF", x: 50, y: 260 },
    { name: "AP-LIB-01", type: "Access Point", ip: "10.50.0.10", loc: "Library", x: 410, y: 300 },
    { name: "SRV-DNS", type: "Server", ip: "10.40.0.11", loc: "Server Farm", x: 410, y: 60 },
    { name: "SRV-DHCP", type: "Server", ip: "10.40.0.12", loc: "Server Farm", x: 410, y: 110 },
    { name: "SRV-WEB", type: "Server", ip: "10.40.0.13", loc: "Server Farm", x: 410, y: 160 },
    { name: "SRV-DB", type: "Server", ip: "10.40.0.14", loc: "Server Farm", x: 410, y: 210 },
    { name: "PC-LAB-01", type: "PC", ip: "10.10.1.21", loc: "Lab 1", x: 230, y: 340 },
    { name: "PC-LAB-02", type: "PC", ip: "10.10.1.22", loc: "Lab 1", x: 300, y: 340 },
    { name: "LAP-FAC-01", type: "Laptop", ip: "10.20.1.51", loc: "Faculty Wing", x: 50, y: 340 },
    { name: "PC-ADMIN-01", type: "PC", ip: "10.30.1.21", loc: "Admin Office", x: 130, y: 300 },
    { name: "LAP-GUEST-01", type: "Laptop", ip: "10.50.0.51", loc: "Visitor Lounge", x: 460, y: 340 },
  ];
  const devIds: Record<string, number> = {};
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const r = await query<{ id: number }>(
      `INSERT INTO netguardian.devices (project_id, name, device_type, ip_address, mac_address, status, location, x, y, uptime_s)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [projectId, d.name, d.type, d.ip, rndMac(i), "online", d.loc, d.x, d.y, Math.floor(Math.random() * 8.6e7 + 3.5e6)]);
    devIds[d.name] = r[0].id;
  }

  // Interfaces
  const ifaces: [string, string, string, string, number | null][] = [
    ["EDGE-RTR-01", "Gi0/0", "203.0.113.1", "255.255.255.252", null],
    ["EDGE-RTR-01", "Gi0/1", "10.0.0.1", "255.255.255.248", null],
    ["FW-01", "WAN", "10.0.0.2", "255.255.255.248", null],
    ["FW-01", "LAN", "10.0.0.9", "255.255.255.248", null],
    ["CORE-SW-01", "Te1/0/1", "10.0.0.10", "255.255.255.248", null],
    ["CORE-SW-01", "Vlan10", "10.10.1.1", "255.255.255.0", 10],
    ["CORE-SW-01", "Vlan20", "10.20.1.1", "255.255.255.0", 20],
    ["CORE-SW-01", "Vlan30", "10.30.1.1", "255.255.255.0", 30],
    ["CORE-SW-01", "Vlan40", "10.40.0.1", "255.255.255.0", 40],
    ["CORE-SW-01", "Vlan50", "10.50.0.1", "255.255.255.0", 50],
    ["SW-BLDG-A", "Gi1/0/24", "10.10.1.2", "255.255.255.0", 10],
    ["SW-BLDG-B", "Gi1/0/24", "10.20.1.2", "255.255.255.0", 20],
    ["SW-BLDG-A", "Gi1/0/1", "10.10.1.2", "255.255.255.0", 10],
    ["SW-BLDG-B", "Gi1/0/1", "10.20.1.2", "255.255.255.0", 20],
    ["SRV-DNS", "eth0", "10.40.0.11", "255.255.255.0", 40],
    ["SRV-DHCP", "eth0", "10.40.0.12", "255.255.255.0", 40],
    ["SRV-WEB", "eth0", "10.40.0.13", "255.255.255.0", 40],
    ["SRV-DB", "eth0", "10.40.0.14", "255.255.255.0", 40],
    ["AP-LIB-01", "wlan0", "10.50.0.10", "255.255.255.0", 50],
    ["PC-LAB-01", "eth0", "10.10.1.21", "255.255.255.0", 10],
    ["PC-LAB-02", "eth0", "10.10.1.22", "255.255.255.0", 10],
    ["LAP-FAC-01", "wlan0", "10.20.1.51", "255.255.255.0", 20],
    ["PC-ADMIN-01", "eth0", "10.30.1.21", "255.255.255.0", 30],
    ["LAP-GUEST-01", "wlan0", "10.50.0.51", "255.255.255.0", 50],
  ];
  for (let i = 0; i < ifaces.length; i++) {
    const [dev, name, ip, mask, vlan] = ifaces[i];
    await query(
      `INSERT INTO netguardian.interfaces (device_id, interface_name, ip_address, subnet_mask, mac_address, vlan_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,'up')`,
      [devIds[dev], name, ip, mask, rndMac(40 + i), vlan]);
  }

  // VLANs
  const vlans: [number, string, string, string][] = [
    [10, "Students", "10.10.1.0/24", "10.10.1.1"],
    [20, "Faculty", "10.20.1.0/24", "10.20.1.1"],
    [30, "Administration", "10.30.1.0/24", "10.30.1.1"],
    [40, "Servers", "10.40.0.0/24", "10.40.0.1"],
    [50, "Guest", "10.50.0.0/24", "10.50.0.1"],
  ];
  for (const [vid, name, subnet, gw] of vlans)
    await query(`INSERT INTO netguardian.vlans (project_id, vlan_id, name, subnet, gateway) VALUES ($1,$2,$3,$4,$5)`,
      [projectId, vid, name, subnet, gw]);

  // Routes (static + OSPF)
  const routes: [string, string, string, string, string, number][] = [
    ["0.0.0.0", "0.0.0.0", "203.0.113.2", "Gi0/0", "static", 1],
    ["10.10.1.0", "255.255.255.0", "Directly connected", "Vlan10", "ospf", 10],
    ["10.20.1.0", "255.255.255.0", "Directly connected", "Vlan20", "ospf", 10],
    ["10.30.1.0", "255.255.255.0", "Directly connected", "Vlan30", "ospf", 10],
    ["10.40.0.0", "255.255.255.0", "Directly connected", "Vlan40", "ospf", 10],
    ["10.50.0.0", "255.255.255.0", "Directly connected", "Vlan50", "ospf", 10],
  ];
  for (const [dst, mask, nh, iface, proto, metric] of routes)
    await query(`INSERT INTO netguardian.routes (project_id, destination, subnet_mask, next_hop, interface_name, protocol, metric) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [projectId, dst, mask, nh, iface, proto, metric]);

  // Topology links (trunks between switches)
  const links: [string, string, string, string, boolean][] = [
    ["EDGE-RTR-01", "FW-01", "Gi0/1", "WAN", false],
    ["FW-01", "CORE-SW-01", "LAN", "Te1/0/1", false],
    ["CORE-SW-01", "SW-BLDG-A", "Te1/0/2", "Gi1/0/24", true],
    ["CORE-SW-01", "SW-BLDG-B", "Te1/0/3", "Gi1/0/24", true],
    ["SW-BLDG-A", "AP-LIB-01", "Gi1/0/2", "wlan0", false],
    ["SW-BLDG-A", "PC-LAB-01", "Gi1/0/3", "eth0", false],
    ["SW-BLDG-A", "PC-LAB-02", "Gi1/0/4", "eth0", false],
    ["SW-BLDG-B", "LAP-FAC-01", "Gi1/0/2", "wlan0", false],
    ["SW-BLDG-B", "PC-ADMIN-01", "Gi1/0/3", "eth0", false],
    ["AP-LIB-01", "LAP-GUEST-01", "wlan0", "wlan0", false],
    ["CORE-SW-01", "SRV-DNS", "Te1/0/4", "eth0", false],
    ["CORE-SW-01", "SRV-DHCP", "Te1/0/5", "eth0", false],
    ["CORE-SW-01", "SRV-WEB", "Te1/0/6", "eth0", false],
    ["CORE-SW-01", "SRV-DB", "Te1/0/7", "eth0", false],
  ];
  for (const [a, b, ai, bi, trunk] of links)
    await query(`INSERT INTO netguardian.topology_links (project_id, source_device, destination_device, source_interface, destination_interface, status, is_trunk)
       VALUES ($1,$2,$3,$4,$5,'up',$6)`, [projectId, devIds[a], devIds[b], ai, bi, trunk]);

  // 24h of simulated metrics per device (hourly)
  const now = Date.now();
  for (const [name, id] of Object.entries(devIds)) {
    const type = devices.find((d) => d.name === name)!.type;
    const base = deviceBaseline(type);
    for (let h = 23; h >= 0; h--) {
      const m = generateMetric(base);
      await query(
        `INSERT INTO netguardian.network_metrics (device_id, latency_ms, packet_loss, bandwidth_mbps, upload_mbps, download_mbps, cpu_usage, memory_usage, connection_count, is_simulated, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)`,
        [id, m.latency_ms, m.packet_loss, m.bandwidth_mbps, m.upload_mbps, m.download_mbps, m.cpu_usage, m.memory_usage, m.connection_count, new Date(now - h * 3600e3)]);
    }
  }

  // ACL + port security
  await query(`INSERT INTO netguardian.acl_rules (project_id, rule_number, source_ip, destination_ip, protocol, port, action, note) VALUES
    ($1,10,'10.50.0.0','10.40.0.0','TCP','443','DENY','Guest VLAN may not reach internal servers except HTTPS'),
    ($1,20,'10.50.0.0','0.0.0.0','TCP','80','ALLOW','Guest internet HTTP'),
    ($1,30,'10.10.0.0','10.40.0.14','TCP','any','DENY','Students may not reach the database server'),
    ($1,40,'0.0.0.0','0.0.0.0','ICMP','any','ALLOW','Permit ICMP for diagnostics')`, [projectId]);
  await query(`INSERT INTO netguardian.port_security (project_id, device_id, switch_port, mac_address, status, violation_count, max_mac) VALUES
    ($1,$2,'Gi1/0/1','00:1B:44:11:22:33','secure',0,1),($1,$2,'Gi1/0/2','00:1B:44:44:55:66','violation',1,1)`,
    [projectId, devIds["SW-BLDG-A"]]);

  // Logs
  const logs: [string, string, number, number][] = [
    ["interface", "SW-BLDG-A interface Gi1/0/24 UP (trunk established)", -22, 60],
    ["dhcp", "PC-LAB-02 received DHCP address 10.10.1.22 from SRV-DHCP (lease 8h)", -22, 35],
    ["ospf", "OSPF neighbor established between CORE-SW-01 and SW-BLDG-A (Area 0, state FULL)", -21, 240],
    ["stp", "STP root bridge elected: CORE-SW-01 (priority 4096)", -20, 120],
    ["threshold", "Packet loss on AP-LIB-01 exceeded 5% threshold (6.2%)", -8, 2],
    ["alert", "Alert generated: abnormal bandwidth on SW-BLDG-A", -8, 3],
    ["dns", "DNS query for lpu.in resolved to 10.40.0.11 by SRV-DNS", -5, 90],
    ["recovery", "Network restored after AP-LIB-01 radio reassociation", -3, 45],
    ["arp", "ARP cache entry refreshed: 10.40.0.13 -> 00:1B:44:1D:2E:3F", -1, 15],
  ];
  for (const [type, msg, hAgo, min] of logs)
    await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message, timestamp) VALUES ($1,$2,$3,$4,$5)`,
      [projectId, devIds["SW-BLDG-A"], type, msg, new Date(now + hAgo * 3600e3 + min * 60e3)]);

  // Alerts
  const alerts: [string, string, string, string, number][] = [
    ["bandwidth_anomaly", "high", "Abnormal bandwidth detected on SW-BLDG-A (640 Mbps vs baseline 190 Mbps).", "active", -2],
    ["packet_loss", "medium", "Packet loss exceeded 5% on AP-LIB-01 (6.2%).", "acknowledged", -8],
    ["cpu", "low", "CPU usage increased on CORE-SW-01 (58%).", "resolved", -14],
    ["port_security", "medium", "Port security violation on SW-BLDG-A Gi1/0/2 — MAC 00:1B:44:44:55:66 exceeded limit.", "active", -6],
    ["info", "informational", "Scheduled configuration backup completed for all core devices.", "resolved", -20],
  ];
  for (const [type, sev, msg, status, hAgo] of alerts)
    await query(`INSERT INTO netguardian.alerts (project_id, device_id, alert_type, severity, message, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [projectId, devIds["SW-BLDG-A"], type, sev, msg, status, new Date(now + hAgo * 3600e3)]);

  return projectId;
}
