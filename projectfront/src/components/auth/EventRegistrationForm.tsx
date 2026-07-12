"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface EventRegistrationFormProps {
  eventId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EventRegistrationForm({
  eventId,
  onSuccess,
  onCancel,
}: EventRegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    registrationNo: "",
    teamName: "",
    institution: "",
    remarks: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post(`/events/${eventId}/register`, formData);

      if (response.data.success) {
        setFormData({
          registrationNo: "",
          teamName: "",
          institution: "",
          remarks: "",
        });
        onSuccess?.();
      } else {
        setError(response.data.message || "Registration failed");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        "Failed to register for event. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Full Name - Read Only */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Full Name
          </label>
          <input
            type="text"
            disabled
            placeholder="Your name (auto-filled from profile)"
            className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-foreground placeholder-muted-foreground disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-filled from your profile
          </p>
        </div>

        {/* Email - Read Only */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            type="email"
            disabled
            placeholder="Your email (auto-filled from profile)"
            className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-foreground placeholder-muted-foreground disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-filled from your profile
          </p>
        </div>

        {/* Phone Number - Read Only */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            disabled
            placeholder="Your phone (auto-filled from profile)"
            className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-foreground placeholder-muted-foreground disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-filled from your profile
          </p>
        </div>

        {/* Registration Number */}
        <div>
          <label htmlFor="registrationNo" className="block text-sm font-medium text-foreground mb-2">
            Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="registrationNo"
            name="registrationNo"
            value={formData.registrationNo}
            onChange={handleChange}
            required
            placeholder="e.g., REG-2026-001 or Roll Number"
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Team Name */}
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium text-foreground mb-2">
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="teamName"
            name="teamName"
            value={formData.teamName}
            onChange={handleChange}
            required
            placeholder="e.g., Team Alpha"
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Institution */}
        <div>
          <label htmlFor="institution" className="block text-sm font-medium text-foreground mb-2">
            Institution <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="institution"
            name="institution"
            value={formData.institution}
            onChange={handleChange}
            required
            placeholder="e.g., College Name / Organization"
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Remarks */}
        <div>
          <label htmlFor="remarks" className="block text-sm font-medium text-foreground mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            id="remarks"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            placeholder="Any additional information or special requests"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? "Registering..." : "Register for Event"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
