import { Badge, Card } from "@/components/ui";

const CONCEPTS: [string, string][] = [
  ["OSI Model", "Layered troubleshooting on Device pages (L1 interface up/down → L3 IP reachability); VLAN/L2 operations at Layer 2, routing at Layer 3, ports at Layer 4."],
  ["TCP/IP Model", "The whole stack: IP addressing (Internet layer), TCP/UDP ports in Diagnostics (Transport), HTTP/HTTPS port checks, DNS (Application)."],
  ["IPv4 Addressing", "Device/interface IP inventory (IPAM page, devices API) with subnet masks, gateways and canonical RFC 1918 private ranges."],
  ["Subnetting", "IPAM subnet calculator computes network/broadcast addresses, usable host ranges, total hosts for any /8–/30 prefix."],
  ["MAC Address", "Every device and interface carries a MAC; port security binds switch ports to sticky MACs (Security page)."],
  ["ARP", "Sample logs show ARP cache refresh events; device↔IP↔MAC mapping visible across IPAM and device details."],
  ["DHCP", "IPAM shows the derived DHCP scope (pool, gateway, DNS, lease); sample logs include DHCP offer/ack events (DORA)."],
  ["DNS", "Diagnostics runs a REAL DNS lookup (A/AAAA/CNAME/MX/TXT) against any domain; sample includes a dedicated DNS server."],
  ["VLAN", "VLAN page: create/delete VLANs with ID/name/subnet/gateway; sample has VLANs 10 (Students), 20 (Faculty), 30 (Admin), 40 (Servers), 50 (Guest)."],
  ["Trunking", "802.1Q trunk links are marked and drawn thick/purple in the topology; trunks carry multiple VLANs between switches."],
  ["Inter-VLAN Routing", "Layer-3 switch SVIs (Vlan10, Vlan20… interfaces on CORE-SW-01) route between VLANs; ACLs can restrict flows."],
  ["Static Routing", "Routing page/table with static default route to the ISP edge in the sample project."],
  ["OSPF", "Routing page documents Router ID, Area 0, neighbor states, cost; sample logs include OSPF adjacency events; reconvergence explained."],
  ["RIP", "Routing page explains distance-vector behavior, hop-count limit, split horizon as a comparison to OSPF."],
  ["NAT", "Edge router + firewall architecture in the sample demonstrates the NAT/PAT boundary concept (private RFC 1918 ↔ public 203.0.113.x)."],
  ["ACL", "Security page: ordered ALLOW/DENY rules (source/destination/protocol/port), evaluated first-match like IOS."],
  ["STP", "Sample logs include root-bridge election; switch device configs show rapid-PVST spanning-tree mode."],
  ["Port Security", "Security page: sticky MAC entries per switch port with violation counts and max-MAC limits."],
  ["TCP/UDP & Ports", "Diagnostics port check runs real TCP connects on 21/22/25/53/80/443; DNS uses UDP 53 (fallback TCP)."],
  ["Ping", "Diagnostics: simulated ICMP echo with sent/received/loss and min/avg/max RTT over modeled topology paths."],
  ["Traceroute", "Diagnostics: simulated hop-by-hop output with per-hop RTTs following the topology graph."],
  ["Packet Loss", "Metric tracked per device and aggregated hourly on the Dashboard; loss thresholds generate alerts."],
  ["Latency", "Metric tracked per device; dashboard latency chart; ping/trace show per-hop latency."],
  ["Bandwidth", "Upload/download/bandwidth utilization charts; bandwidth-spike scenarios feed anomaly detection."],
  ["Network Topology", "Interactive SVG topology editor: add/move/connect/delete devices, status-colored links, device detail panel."],
  ["Fault Tolerance", "Failure simulation recalculates connectivity (BFS reachability), lists impacted devices, and models alternate-path selection."],
];

export default function Concepts() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Academic Concepts</h1>
        <p className="text-xs text-slate-500">Computer Networks concepts covered by NetGuardian and where to find each implementation.</p>
      </div>
      <Card>
        <table className="w-full">
          <thead><tr><th className="th w-48">Concept</th><th className="th">Where it&apos;s implemented</th></tr></thead>
          <tbody>
            {CONCEPTS.map(([c, where]) => (
              <tr key={c}>
                <td className="td font-semibold text-slate-200">{c}</td>
                <td className="td text-slate-400 text-xs leading-relaxed">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-600"><Badge tone="info">Note</Badge> Telemetry (latency, bandwidth, packet loss) is simulated and labeled; DNS and port checks are real. Architecture is modular so SNMP/NetFlow/Syslog integrations can be added later.</p>
    </div>
  );
}
