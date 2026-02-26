"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getStoredUser, logout } from "@/lib/auth";
import type { User } from "@/lib/auth";

export default function UserProfile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Logged in as</p>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
            {user.role}
          </span>
          {user.isActive && (
            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Active
            </span>
          )}
        </div>

        {user.studentId && (
          <div>
            <p className="text-sm text-muted-foreground">Student ID</p>
            <p className="font-medium">{user.studentId}</p>
          </div>
        )}

        {user.program && (
          <div>
            <p className="text-sm text-muted-foreground">Program</p>
            <p className="font-medium">{user.program}</p>
          </div>
        )}

        {user.year && (
          <div>
            <p className="text-sm text-muted-foreground">Year</p>
            <p className="font-medium">Year {user.year}</p>
          </div>
        )}

        {user.societyName && (
          <div>
            <p className="text-sm text-muted-foreground">Society</p>
            <p className="font-medium">{user.societyName}</p>
          </div>
        )}

        <Button onClick={handleLogout} variant="outline" className="w-full">
          Logout
        </Button>
      </div>
    </div>
  );
}
