import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetGuardian — Intelligent Network Monitoring & Security Platform",
  description: "Design, monitor and secure enterprise computer networks — NOC dashboard, topology, VLANs, routing, diagnostics, anomaly detection and security monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-noc-bg text-slate-200">{children}</body>
    </html>
  );
}
