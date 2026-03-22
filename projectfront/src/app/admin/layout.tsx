import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModuleNav } from "@/components/navigation/module-nav";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/committee", label: "Committee" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/financial-records", label: "Financial Records" },
  { href: "/admin/student-affairs", label: "Student Affairs" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export const metadata: Metadata = {
  title: "Admin Console • CSE Society Budget & Event Management",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin"]} redirectTo="/login">
      <div className="space-y-10">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Admin Command Center</h1>
              <p className="text-sm text-muted-foreground">
                Govern applications, budgets, documents, accounts, and analytics with full auditability.
              </p>
            </div>
            <ModuleNav items={links} />
          </div>
        </div>
        {children}
      </div>
    </ProtectedRoute>
  );
}
