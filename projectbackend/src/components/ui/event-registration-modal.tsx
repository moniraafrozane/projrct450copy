"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Event } from "@/lib/api";

interface EventRegistrationModalProps {
  event: Event;
  userPhone?: string;
  userRegistrationNumber?: string;
  onClose: () => void;
  onSubmit: (registrationData: {
    fullName: string;
    email: string;
    userPhone: string;
    registrationNumber: string;
    teamName: string;
    institution: string;
    remarks: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function EventRegistrationModal({
  event,
  userPhone,
  userRegistrationNumber,
  onClose,
  onSubmit,
  isLoading = false,
}: EventRegistrationModalProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    userPhone: userPhone || "",
    registrationNumber: userRegistrationNumber || "",
    teamName: "",
    institution: "",
    remarks: "",
  });
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.fullName.trim()) {
      setError("Full Name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!formData.registrationNumber.trim()) {
      setError("Registration Number is required");
      return;
    }
    if (!formData.teamName.trim()) {
      setError("Team Name is required");
      return;
    }
    if (!formData.institution.trim()) {
      setError("Institution is required");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to register");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/70 bg-background p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground">{event.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Event Registration</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Full Name *</span>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="e.g., Monira Afroz Ane"
            />
          </label>

          {/* Email Address */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Email Address *</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="your.email@example.com"
            />
          </label>

          {/* Phone Number */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Phone Number</span>
            <input
              type="tel"
              name="userPhone"
              value={formData.userPhone}
              onChange={handleChange}
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="e.g., 01318194008"
            />
            <span className="text-xs text-muted-foreground">Auto-filled from your profile. You can edit it.</span>
          </label>

          {/* Registration Number */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Registration No *</span>
            <input
              type="text"
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="e.g., 20XX331XXX"
            />
          </label>

          {/* Team Name */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Team Name *</span>
            <input
              type="text"
              name="teamName"
              value={formData.teamName}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="e.g., Team Alpha, Dragons, etc."
            />
          </label>

          {/* Institution */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Institution *</span>
            <input
              type="text"
              name="institution"
              value={formData.institution}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="e.g., ABC University"
            />
          </label>

          {/* Additional Remarks */}
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Additional Remarks</span>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              disabled={isLoading}
              rows={3}
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              placeholder="Any additional information (optional)"
            />
          </label>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Registering..." : "Register Now"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
