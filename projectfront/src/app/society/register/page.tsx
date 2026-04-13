"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { register, getRedirectPath } from "@/lib/auth";

export default function SocietyRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    studentId: "",
    phone: "",
    societyRole: "",
    year: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    // Validate required fields
    if (!formData.name || !formData.email || !formData.studentId || !formData.phone || !formData.societyRole || !formData.year) {
      setError("All fields are required for society member registration");
      return;
    }

    setIsLoading(true);

    try {
      const response = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: "society",
        studentId: formData.studentId,
        societyRole: formData.societyRole,
        year: formData.year ? parseInt(formData.year) : undefined,
      });

      if (response.success) {
        // Redirect to homepage
        router.push("/");
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
          eyebrow="Society Member Registration"
          title="Join as Society Member"
          description="Register to manage society activities and events."
          actions={[
            { label: "Login", href: "/login", variant: "secondary" },
            { label: "Return home", href: "/", variant: "outline" },
          ]}
        />

        <SectionCard
          title="Society member details"
          description="All fields are required for society member account creation."
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
                placeholder="e.g., Sarah Ahmed"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Registration number *
              <input
                type="text"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                placeholder="2020331081"
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
              Role in Society *
              <select
                name="societyRole"
                value={formData.societyRole}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
              >
                <option value="">Select role</option>
                <option value="President">President</option>
                <option value="Vice President">Vice President</option>
                <option value="Secretary">Secretary</option>
                <option value="Treasurer">Treasurer</option>
                <option value="Event Coordinator">Event Coordinator</option>
                <option value="Member">Member</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Year *
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground disabled:opacity-50"
                placeholder="1, 2, 3, or 4"
                min="1"
                max="6"
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
              {isLoading ? "Creating account..." : "Create Society Account"}
            </Button>
          </div>
        </SectionCard>
    </div>
  );
}
