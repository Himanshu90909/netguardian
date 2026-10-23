# NetGuardian — Intelligent Network Monitoring & Security Platform

Enterprise-style NOC dashboard for designing, monitoring and securing computer networks.
Built for the LPU Computer Networks semester project (viva + portfolio ready).

**Live:** https://netguardian-psi.vercel.app

## Features
- Real authentication (email/password + optional Google OAuth), per-user data isolation
- PostgreSQL (Neon) persistence — devices, interfaces, VLANs, routes, metrics, alerts, logs, links, ACLs, port security
- Interactive topology editor (drag, connect, status-colored links, 802.1Q trunks)
- IPAM with subnet calculator (any /8–/30 CIDR) and DHCP scope view
- VLAN management, inter-VLAN routing (SVIs), trunking
- Routing (static / RIP / OSPF) with routing table and reconvergence demo
- Diagnostics: simulated ping & traceroute over the modeled topology; REAL DNS lookup and port check
- Security: ACLs, port security, suspicious-traffic heuristics (labeled educational, not an IDS)
- Explainable anomaly detection (z-score vs per-device baselines, risk scores, reasons)
- Failure simulation (device/router/switch/link failures with impact analysis)
- Alert center, centralized logs, report generation (PDF via print + CSV export)
- Academic Concepts page mapping every CN concept to its implementation

## Stack
Next.js 14 (App Router, TypeScript) · Tailwind CSS · Recharts · NextAuth · Neon Postgres (serverless HTTP) · Vercel

## Data honesty
Simulated telemetry is clearly labeled SIMULATED. DNS and port checks are real. No enterprise IDS claims.

## Deploy
```
DATABASE_URL=<neon postgres url>  NEXTAUTH_SECRET=<random>  NEXTAUTH_URL=<app url>
# optional: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_GOOGLE_ENABLED=1
```
`npm run build && npm start`. Schema auto-bootstraps on first API call (schema `netguardian`).
