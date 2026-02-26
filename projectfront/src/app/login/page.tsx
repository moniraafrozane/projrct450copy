"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { login, getRedirectPath } from "@/lib/auth";

export default function UnifiedLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            eyebrow="Single entry point"
            title="Unified login portal"
            description="Loading role preferences…"
          />
          <div className="rounded-2xl border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
            Preparing secure login form…
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRole = searchParams.get("role") ?? "student";
  
  // Normalize role to match backend enum
  const normalizedRole = useMemo(() => {
    if (rawRole === "society member" || rawRole === "society") return "society";
    if (rawRole === "admin") return "admin";
    return "student";
  }, [rawRole]);
  
  // Display role with proper formatting
  const selectedRole = useMemo(() => {
    if (normalizedRole === "society") return "Society Member";
    if (normalizedRole === "admin") return "Admin";
    return "Student";
  }, [normalizedRole]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await login({
        email,
        password,
        role: normalizedRole,
      });

      if (response.success) {
        // Redirect to role-specific dashboard
        const redirectPath = getRedirectPath(response.user);
        router.push(redirectPath);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.message || "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Single entry point"
        title="Unified login portal"
        description="Enter your credentials below to access the workspace."
        actions={[{ label: "Return home", href: "/", variant: "outline" }]}
      />

      <SectionCard
        title="Sign in"
        description="Choose your role, enter credentials, and the system directs you to the correct module while logging the Date & Time stamp."
      >
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 text-sm md:col-span-2">
              Selected role
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-base font-semibold capitalize text-foreground">
                {selectedRole}
              </div>
              <p className="text-xs text-muted-foreground">Return to the homepage to switch roles.</p>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                placeholder="your.email@example.com"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                placeholder="••••••••"
              />
            </label>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Continue"}
            </Button>
            <Button type="button" variant="outline" asChild disabled={isLoading}>
              <Link href="/password-reset">Forgot password (all roles)</Link>
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
