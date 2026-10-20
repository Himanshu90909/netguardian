"use client";
import { SessionProvider } from "next-auth/react";
import { ProjectProvider } from "./ProjectContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProjectProvider>{children}</ProjectProvider>
    </SessionProvider>
  );
}
