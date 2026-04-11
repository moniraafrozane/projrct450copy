"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser, updateProfile, isAuthenticated } from "@/lib/auth";

type ProfileForm = {
  registration: string;
  name: string;
  email: string;
  phone: string;
};

export default function StudentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<ProfileForm>({
    registration: "",
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      try {
        const user = await getCurrentUser();
        setForm({
          registration: user.studentId || "",
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
        });
      } catch (err: any) {
        console.error("Profile load error:", err);
        // If it's a 401, the interceptor will handle redirect
        // For other errors, show message
        if (err?.response?.status !== 401) {
          setError(err?.response?.data?.message || "Failed to load profile. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateProfile({
        name: form.name.trim(),
        studentId: form.registration.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });

      setForm({
        registration: updated.studentId || "",
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
      });
      setSuccess("Profile updated successfully");
      setEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Profile & security"
        description="Update contact information, manage preferences, and trigger password resets."
      />

      <SectionCard title="Personal details" description="Changes cascade across society and admin modules.">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">registration</p>
              {editing ? (
                <Input
                  value={form.registration}
                  onChange={(e) => handleChange("registration", e.target.value)}
                  placeholder="Enter registration number"
                  className="mt-2"
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{form.registration || "Not provided"}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">name</p>
              {editing ? (
                <Input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter name"
                  className="mt-2"
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{form.name || "Not provided"}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">email</p>
              {editing ? (
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter email"
                  className="mt-2"
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{form.email || "Not provided"}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">phone</p>
              {editing ? (
                <Input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="Enter phone"
                  className="mt-2"
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{form.phone || "Not provided"}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!editing ? (
            <Button className="w-fit" onClick={() => setEditing(true)} disabled={loading}>
              Edit profile
            </Button>
          ) : (
            <>
              <Button className="w-fit" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setSuccess("");
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Preferences" description="Customize how you receive event updates and admin feedback.">
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">Notifications</p>
              <p className="text-sm text-muted-foreground mt-1">
                Manage which notifications you receive — bank receipts, new events, event updates, and reminders.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
