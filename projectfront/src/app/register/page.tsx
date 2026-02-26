"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { register, getRedirectPath } from "@/lib/auth";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            eyebrow="Create your account"
            title="Sign Up"
            description="Loading registration form…"
          />
          <div className="rounded-2xl border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
            Preparing registration form…
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRole = searchParams.get("role") ?? "student";
  
  // Normalize role to match backend enum
  const normalizedRole = useMemo(() => {
    if (rawRole === "society member" || rawRole === "society") return "society";
    if (rawRole === "admin") return "admin";
    return "student";
  }, [rawRole]);

  const selectedRole = useMemo(() =>
    rawRole
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" "),
  [rawRole]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    registrationNumber: "",
    program: "",
    year: "",
    societyName: "",
    societyRole: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const registerData: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: normalizedRole,
      };

      // Add role-specific fields
      if (normalizedRole === "student") {
        registerData.registrationNumber = formData.registrationNumber || undefined;
        registerData.program = formData.program || undefined;
        registerData.year = formData.year ? parseInt(formData.year) : undefined;
      } else if (normalizedRole === "society") {
        registerData.societyRole = formData.societyRole || undefined;
      } else if (normalizedRole === "admin") {
        registerData.phone = formData.phone;
      }

      const response = await register(registerData);

      if (response.success) {
        // Redirect to role-specific dashboard
        const redirectPath = getRedirectPath(response.user);
        router.push(redirectPath);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Registration failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10">
        <PageHeader
          eyebrow="Create your account"
          title={`Sign Up as ${selectedRole}`}
          description="Share your details below so we can activate the right workspace for you."
          actions={[
            { label: "Back to login", href: `/login?role=${rawRole}`, variant: "secondary" },
            { label: "Return home", href: "/", variant: "outline" },
          ]}
        />

        <SectionCard
          title="Registration details"
          description={`Complete the form below to register as ${selectedRole.toLowerCase()}.`}
        >
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Selected Role Display */}
              <div className="flex flex-col gap-2 text-sm md:col-span-2">
                Selected role
                <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-base font-semibold capitalize text-foreground">
                  {selectedRole}
                </div>
                <p className="text-xs text-muted-foreground">Return to the homepage to switch roles.</p>
              </div>

              {/* Common Fields */}
              <label className="flex flex-col gap-2 text-sm">
                Full name *
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                  placeholder="e.g., Monira Afroz"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Email *
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                  placeholder="your.email@example.com"
                />
              </label>

              {/* Student-specific fields */}
              {normalizedRole === "student" && (
                <>
                  <label className="flex flex-col gap-2 text-sm">
                    Regiatration Number
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                      placeholder="20XX331XXX"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Program
                    <input
                      type="text"
                      name="program"
                      value={formData.program}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                      placeholder="e.g., Computer Science and Engineering"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Year
                    <input
                      type="number"
                      name="year"
                      value={formData.year}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                      placeholder="1, 2, 3, or 4"
                      min="1"
                      max="6"
                    />
                  </label>
                </>
              )}

              {/* Society-specific fields */}
              {normalizedRole === "society" && (
                <>
                  <label className="flex flex-col gap-2 text-sm">
                    Your Role in Society
                    <input
                      type="text"
                      name="societyRole"
                      value={formData.societyRole}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                      placeholder="e.g., Vice President,General Secretary,Event and Cultural secretary,Sports secretary,Publication Secretary,Executive Member"
                    />
                  </label>
                </>
              )}

              {/* Admin-specific fields */}
              {normalizedRole === "admin" && (
                <label className="flex flex-col gap-2 text-sm md:col-span-2">
                  Phone number *
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                    placeholder="e.g., +88 017XXXXXXXX"
                  />
                </label>
              )}

              {/* Password fields */}
              <label className="flex flex-col gap-2 text-sm">
                Password *
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                  placeholder="••••••••"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Confirm password *
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                  placeholder="Repeat password"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </div>
          </form>
        </SectionCard>
    </div>
  );
}
