import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: `${site.name} · Workspace` };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
