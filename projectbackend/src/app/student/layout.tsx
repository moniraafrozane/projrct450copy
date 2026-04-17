import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModuleNav } from "@/components/navigation/module-nav";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const links = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/applications", label: "Certificates" },
  { href: "/student/profile", label: "Profile" },
  { href: "/student/bank-receipt", label: "Bank Upload" },
];

export const metadata: Metadata = {
  title: "Student Workspace • CSE Society Budget & Event Management",
};

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["student"]} redirectTo="/login">
      <div className="space-y-10">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Student Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Interact with events, follow submissions, download certificates, and stay current with admin updates.
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
