"use client";

import type { ReactNode } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function EventDetailLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["student"]} redirectTo="/login">
      {children}
    </ProtectedRoute>
  );
}
