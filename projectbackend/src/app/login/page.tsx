"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth";

const ROLE_OPTIONS = [
  { value: "student", label: "Student", icon: "🎓" },
  { value: "society", label: "Society Member", icon: "👥" },
  { value: "admin",   label: "Admin",          icon: "👨‍💼" },
];

const ROLE_PATHS: Record<string, string> = {
  student: "/student",
  society: "/society",
  admin:   "/admin",
};

export default function UnifiedLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            eyebrow="Single entry point"
            title="Unified login portal"
            description="Loading…"
          />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();

  const [role, setRole]         = useState("student");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getErrorMessage = (err: any) => {
    if (typeof err?.response?.data === "string" && err.response.data.trim()) {
      return err.response.data;
    }

    if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim()) {
      return err.response.data.message;
    }

    return "Login failed. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await login({ email, password, role });

      if (response.success) {
        // Redirect based on the role the user chose to log in as
        router.push(ROLE_PATHS[role] ?? "/");
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Single entry point"
        title="Unified login portal"
        description="Select your role, enter your credentials, and we'll take you straight to your dashboard."
        actions={[{ label: "Return home", href: "/", variant: "outline" }]}
      />

      <SectionCard
        title="Sign in"
        description="One account, multiple roles. Choose the workspace you want to enter today."
      >
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role selector */}
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Sign in as</span>
            <div className="grid grid-cols-3 gap-3">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border p-4 transition-colors ${
                    role === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/70 hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                    className="sr-only"
                  />
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Credentials */}
          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
            <Link
              href="/password-reset"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </SectionCard>
    </div>
  );
}
