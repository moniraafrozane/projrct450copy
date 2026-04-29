"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { register } from "@/lib/auth";

type SignupRole = "student" | "admin" | "society";

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterFallback() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create your account"
        title="Sign Up"
        description="Loading registration form..."
      />
      <div className="rounded-2xl border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
        Preparing registration form...
      </div>
    </div>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedRole = useMemo<SignupRole>(() => {
    const role = (searchParams.get("role") || "student").trim().toLowerCase();
    if (role === "admin") return "admin";
    if (role === "society" || role === "society member") return "society";
    return "student";
  }, [searchParams]);

  const roleLabel = useMemo(() => {
    if (selectedRole === "society") return "Society Member";
    if (selectedRole === "admin") return "Admin";
    return "Student";
  }, [selectedRole]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    registrationNumber: "",
    program: "",
    year: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (selectedRole === "student" && !formData.registrationNumber.trim()) {
      setError("Registration number is required for student signup");
      return;
    }

    if ((selectedRole === "student" || selectedRole === "admin") && !formData.phone.trim()) {
      setError(selectedRole === "admin" ? "Phone number is required for admin signup" : "Phone number is required for student signup");
      return;
    }

    setIsLoading(true);

    try {
      const parsedYear = formData.year ? parseInt(formData.year, 10) : undefined;
      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: selectedRole,
        phone: selectedRole === "society" ? undefined : formData.phone.trim(),
        studentId: selectedRole === "student" ? formData.registrationNumber.trim() : undefined,
        program: selectedRole === "student" ? formData.program || undefined : undefined,
        year: selectedRole === "student" && !Number.isNaN(parsedYear) ? parsedYear : undefined,
      };

      const response = await register(registerData);

      if (response.success) {
        router.push("/");
      }
    } catch (submitError: unknown) {
      setError(getApiErrorMessage(submitError, "Registration failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const roleDescription =
    selectedRole === "student"
      ? "Create a student account directly from this form."
      : selectedRole === "admin"
      ? "Create an admin account with required contact details."
      : "If admin already added you as an active committee member, you can complete society signup here.";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Create your account"
        title={`Sign Up as ${roleLabel}`}
        description={roleDescription}
        actions={[
          { label: "Back to login", href: "/login", variant: "secondary" },
          { label: "Choose another role", href: "/signup", variant: "outline" },
        ]}
      />

      <SectionCard title="Registration details" description={roleDescription}>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 text-sm md:col-span-2">
                Selected role
                <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-base font-semibold text-foreground">
                  {roleLabel}
                </div>
              </div>

              {selectedRole === "society" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 md:col-span-2">
                  Use the same email and password of your existing account. Signup works only if admin already added you as an active committee member.
                </div>
              )}

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

              {selectedRole === "student" && (
                <>
                  <label className="flex flex-col gap-2 text-sm">
                    Registration Number *
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                      placeholder="20XX331XXX"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
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

              {selectedRole === "admin" && (
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
                  placeholder="........"
                />
                <p className="text-xs text-muted-foreground">Password must be at least 6 characters long</p>
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
                {isLoading ? "Creating account..." : `Sign Up as ${roleLabel}`}
              </Button>
              {selectedRole === "society" && (
                <Button asChild variant="outline" type="button">
                  <Link href="/register?role=student">Need a student account first?</Link>
                </Button>
              )}
            </div>
          </form>
      </SectionCard>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}
