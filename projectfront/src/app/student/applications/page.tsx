"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventAPI, EventRegistration } from "@/lib/api";

// Sample applications for demonstration
const sampleApplications = [
  {
    id: "sample-1",
    event: {
      title: "AI & Ethics Forum",
    },
    registrationDate: "2026-01-03T10:24:00.000Z",
    status: "waitlisted",
    paymentStatus: "pending",
  },
  {
    id: "sample-2",
    event: {
      title: "Cultural Night",
    },
    registrationDate: "2025-12-10T14:18:00.000Z",
    status: "confirmed",
    paymentStatus: "paid",
  },
  {
    id: "sample-3",
    event: {
      title: "Ideation Sprint",
    },
    registrationDate: "2025-11-28T17:44:00.000Z",
    status: "cancelled",
    paymentStatus: "refunded",
  },
];

export default function StudentApplicationsPage() {
  const [registrations, setRegistrations] = useState<any[]>(sampleApplications);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const response = await eventAPI.getMyRegistrations();
      // If we have real data, use it; otherwise keep sample data
      if (response.registrations && response.registrations.length > 0) {
        setRegistrations(response.registrations);
      }
    } catch (err: any) {
      console.error("Failed to fetch registrations, using sample data:", err);
      // Keep sample data on error
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to cancel your registration for "${eventTitle}"?`)) {
      return;
    }

    try {
      setCancelling(eventId);
      await eventAPI.cancelRegistration(eventId);
      alert("Registration cancelled successfully");
      fetchRegistrations();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to cancel registration";
      alert(errorMessage);
    } finally {
      setCancelling(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'waitlisted': return 'warning';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Approved';
      case 'waitlisted': return 'Under review';
      case 'cancelled': return 'Rejected';
      default: return status;
    }
  };

  const getStatusMessage = (registration: any) => {
    if (registration.status === 'confirmed' && registration.paymentStatus === 'paid') {
      return 'Certificate ready';
    } else if (registration.status === 'confirmed' && registration.paymentStatus === 'pending') {
      return 'Awaiting payment confirmation';
    } else if (registration.status === 'waitlisted') {
      return 'Awaiting admin feedback';
    } else if (registration.status === 'cancelled') {
      return 'Comments from admin';
    }
    return 'Processing';
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Application & history"
        description="Monitor every submission, related timestamp, and admin response in one view."
        actions={[
          {
            label: "Generate application",
            href: "/student/events",
          },
        ]}
      />

      <SectionCard
        title="History"
        description="Each record includes approval metadata and download links."
      >
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading applications...</div>
        ) : registrations.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">You haven't submitted any applications yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((registration) => (
              <div key={registration.id} className="rounded-2xl border border-border/70 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {registration.event.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Submitted {formatDate(registration.registrationDate)}
                    </p>
                  </div>
                  
                  <Badge variant={getStatusBadgeVariant(registration.status)}>
                    {getStatusLabel(registration.status)}
                  </Badge>
                </div>
                
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{getStatusMessage(registration)}</span>
                  <Button variant="outline" size="sm">
                    View log
                  </Button>
                  {registration.status === 'confirmed' && registration.paymentStatus === 'paid' && (
                    <Button size="sm">
                      Download certificate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
