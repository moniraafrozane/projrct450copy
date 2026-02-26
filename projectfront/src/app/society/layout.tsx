import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModuleNav } from "@/components/navigation/module-nav";

const links = [
  { href: "/society", label: "Dashboard" },
  { href: "/society/event-planner", label: "Event planner" },
  { href: "/society/applications", label: "Applications" },
  { href: "/society/budgets", label: "Budgets" },
  { href: "/society/vouchers", label: "Vouchers" },
  { href: "/society/post-event", label: "Post-event" },
  { href: "/society/resources", label: "Resources" },
];

export const metadata: Metadata = {
  title: "Society Workspace • CSE Society Budget & Event Management",
};

export default function SocietyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-border/70 bg-card/80 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Society Ops Studio</h1>
            <p className="text-sm text-muted-foreground">
              Manage budgets, pass student applications to admins, and submit post-event reports.
            </p>
          </div>
          <ModuleNav items={links} />
        </div>
      </div>
      {children}
    </div>
  );
}
