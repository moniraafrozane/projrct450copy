"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { register, getRedirectPath } from "@/lib/auth";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    // Validate phone number
    if (!formData.phone || formData.phone.trim() === "") {
      setError("Phone number is required for admin registration");
      return;
    }

    setIsLoading(true);

    try {
      const response = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: "admin",
      });

      if (response.success) {
        // Redirect to admin dashboard
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
          eyebrow="Admin Registration"
          title="Create Admin Account"
          description="Register as an administrator to manage the system."
          actions={[
            { label: "Admin login", href: "/admin/login", variant: "secondary" },
            { label: "Return home", href: "/", variant: "outline" },
          ]}
        />

        <SectionCard
          title="Administrator details"
          description="All fields are required for admin account creation."
        >
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
                placeholder="e.g., John Doe"
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
                placeholder="admin@example.com"
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
                placeholder="8801XXXXXXXX"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Role *
              <input
                type="text"
                name="role"
                value="Admin"
                disabled
                className="rounded-2xl border border-border/70 bg-muted px-4 py-3 text-base text-foreground disabled:opacity-70"
              />
            </label>
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
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Admin Account"}
            </Button>
          </div>
        </SectionCard>
    </div>
  );
}
