// NetGuardian database layer — Neon Postgres over HTTP (serverless-safe).
import { neon } from "@neondatabase/serverless";

const SCHEMA = "netguardian";
let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    _sql = neon(url);
  }
  return _sql;
}

export async function query<T = any>(q: string, params: any[] = []): Promise<T[]> {
  const s = sql() as any;
  const fn = typeof s.query === "function" ? s.query.bind(s) : s;
  const rows = (await fn(q, params)) as any[];
  return rows as T[];
}

let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!_ready) _ready = bootstrap().catch((e) => { _ready = null; throw e; });
  return _ready;
}

async function bootstrap() {
  const s = sql() as any;
  const fn = typeof s.query === "function" ? s.query.bind(s) : s;
  const run = (q: string) => fn(q, []);
  await run(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  const t = (name: string) => `${SCHEMA}.${name}`;
  await run(`CREATE TABLE IF NOT EXISTS ${t("users")} (
    id SERIAL PRIMARY KEY, email VARCHAR(320) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL,
    profile_image TEXT, password_hash TEXT, provider VARCHAR(32) DEFAULT 'credentials',
    created_at TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("projects")} (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES ${t("users")}(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL, description TEXT, network_type VARCHAR(64) DEFAULT 'Enterprise LAN',
    is_sample BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("devices")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL, device_type VARCHAR(40) NOT NULL, ip_address VARCHAR(45),
    mac_address VARCHAR(17), status VARCHAR(16) DEFAULT 'online', location VARCHAR(120),
    x REAL DEFAULT 0, y REAL DEFAULT 0, uptime_s BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("interfaces")} (
    id SERIAL PRIMARY KEY, device_id INTEGER NOT NULL REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    interface_name VARCHAR(64) NOT NULL, ip_address VARCHAR(45), subnet_mask VARCHAR(15),
    mac_address VARCHAR(17), vlan_number INTEGER, status VARCHAR(16) DEFAULT 'up')`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("vlans")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    vlan_id INTEGER NOT NULL, name VARCHAR(80) NOT NULL, subnet VARCHAR(20), gateway VARCHAR(45))`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("routes")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    destination VARCHAR(20) NOT NULL, subnet_mask VARCHAR(15) DEFAULT '255.255.255.0',
    next_hop VARCHAR(45), interface_name VARCHAR(64), protocol VARCHAR(16) DEFAULT 'static', metric INTEGER DEFAULT 1)`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("network_metrics")} (
    id SERIAL PRIMARY KEY, device_id INTEGER NOT NULL REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    latency_ms REAL, packet_loss REAL, bandwidth_mbps REAL, upload_mbps REAL, download_mbps REAL,
    cpu_usage REAL, memory_usage REAL, connection_count INTEGER DEFAULT 0,
    is_simulated BOOLEAN DEFAULT true, timestamp TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE INDEX IF NOT EXISTS ng_metrics_dev_ts ON ${t("network_metrics")}(device_id, timestamp)`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("alerts")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    alert_type VARCHAR(40) NOT NULL, severity VARCHAR(16) NOT NULL, message TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ)`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("logs")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL, message TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("topology_links")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    source_device INTEGER NOT NULL REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    destination_device INTEGER NOT NULL REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    source_interface VARCHAR(64), destination_interface VARCHAR(64),
    status VARCHAR(16) DEFAULT 'up', is_trunk BOOLEAN DEFAULT false)`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("acl_rules")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    rule_number INTEGER NOT NULL, source_ip VARCHAR(45) NOT NULL, destination_ip VARCHAR(45) NOT NULL,
    protocol VARCHAR(8) DEFAULT 'TCP', port VARCHAR(8) DEFAULT 'any', action VARCHAR(8) NOT NULL,
    note TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("port_security")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES ${t("devices")}(id) ON DELETE CASCADE,
    switch_port VARCHAR(16) NOT NULL, mac_address VARCHAR(17) NOT NULL,
    status VARCHAR(16) DEFAULT 'secure', violation_count INTEGER DEFAULT 0, max_mac INTEGER DEFAULT 1)`);
  await run(`CREATE TABLE IF NOT EXISTS ${t("anomaly_results")} (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES ${t("projects")}(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL, metric VARCHAR(32) NOT NULL, expected_value REAL, observed_value REAL,
    deviation REAL, risk_score INTEGER, reason TEXT, detected_at TIMESTAMPTZ DEFAULT now())`);
}
