"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { eventAPI, RegistrationLogEvent, RegistrationLogResponse } from "@/lib/api";
import { generateEventCertificate } from "@/lib/certificate";

// Sample applications for demonstration
const sampleApplications = [
  {
    id: "sample-1",
    eventId: "sample-event-1",
    event: {
      title: "AI & Ethics Forum",
    },
    registrationDate: "2026-01-03T10:24:00.000Z",
    status: "waitlisted",
    paymentStatus: "pending",
    isSample: true,
  },
  {
    id: "sample-2",
    eventId: "sample-event-2",
    event: {
      title: "Cultural Night",
    },
    registrationDate: "2025-12-10T14:18:00.000Z",
    status: "confirmed",
    paymentStatus: "paid",
    isSample: true,
  },
  {
    id: "sample-3",
    eventId: "sample-event-3",
    event: {
      title: "Ideation Sprint",
    },
    registrationDate: "2025-11-28T17:44:00.000Z",
    status: "cancelled",
    paymentStatus: "refunded",
    isSample: true,
  },
];

export default function StudentApplicationsPage() {
  const [registrations, setRegistrations] = useState<any[]>(sampleApplications);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [registrationLog, setRegistrationLog] = useState<RegistrationLogResponse | null>(null);

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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
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

  const handleDownloadCertificate = async (registration: any) => {
    try {
      setDownloading(registration.id);

      // Get student name from registration or localStorage fallback
      let studentName = registration.userName || "Participant";
      if (!studentName || studentName === "Participant") {
        try {
          const userStr = localStorage.getItem("user");
          if (userStr) {
            const user = JSON.parse(userStr);
            studentName = user.name || "Participant";
          }
        } catch {
          // keep default
        }
      }

      generateEventCertificate({
        studentName,
        eventTitle: registration.event.title,
        eventDate: registration.event.eventDate || registration.registrationDate,
        eventVenue: registration.event.venue || "University Campus",
        organizerName: registration.event.organizerName || "Event Organiser",
        registrationDate: registration.registrationDate,
      });
    } catch (err) {
      console.error("Certificate generation failed:", err);
      alert("Failed to generate certificate. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const createFallbackLog = (registration: any): RegistrationLogResponse => {
    const fallbackLogs: RegistrationLogEvent[] = [
      {
        id: `${registration.id}-submitted`,
        registrationId: registration.id,
        eventType: 'submitted',
        actorRole: 'student',
        actorName: registration.userName || 'Student',
        message: 'Application submitted',
        createdAt: registration.registrationDate,
      },
    ];

    if (registration.status === 'waitlisted') {
      fallbackLogs.push({
        id: `${registration.id}-under-review`,
        registrationId: registration.id,
        eventType: 'under_review',
        actorRole: 'admin',
        actorName: 'Admin',
        message: 'Application moved to under review',
        createdAt: registration.registrationDate,
      });
    }

    if (registration.status === 'confirmed') {
      fallbackLogs.push({
        id: `${registration.id}-approved`,
        registrationId: registration.id,
        eventType: 'approved',
        actorRole: 'admin',
        actorName: 'Admin',
        message: 'Application approved',
        createdAt: registration.registrationDate,
      });
    }

    if (registration.status === 'cancelled') {
      fallbackLogs.push({
        id: `${registration.id}-rejected`,
        registrationId: registration.id,
        eventType: 'rejected',
        actorRole: 'admin',
        actorName: 'Admin',
        message: 'Application rejected',
        createdAt: registration.registrationDate,
      });
    }

    return {
      success: true,
      registration: {
        id: registration.id,
        eventId: registration.eventId || `fallback-${registration.id}`,
        eventName: registration.event?.title || 'Event',
        submittedAt: registration.registrationDate,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
      },
      logs: fallbackLogs,
    };
  };

  const getLogEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'submitted':
        return 'Submitted';
      case 'under_review':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'comment_added':
        return 'Comment added';
      case 'certificate_uploaded':
        return 'Certificate uploaded';
      case 'certificate_ready':
        return 'Certificate ready';
      case 'email_sent':
        return 'Email sent';
      case 'receipt_generated':
        return 'Receipt generated';
      default:
        return eventType;
    }
  };

  const getStatusLabelFromRegistrationStatus = (status: string) => {
    if (status === 'waitlisted') return 'Under Review';
    if (status === 'confirmed') return 'Approved';
    if (status === 'cancelled') return 'Rejected';
    return status;
  };

  const handleOpenLog = async (registration: any) => {
    setSelectedRegistrationId(registration.id);
    setLogOpen(true);
    setLogError("");
    setLogLoading(true);

    if (!registration.eventId || registration.isSample) {
      setRegistrationLog(createFallbackLog(registration));
      setLogLoading(false);
      return;
    }

    try {
      const response = await eventAPI.getRegistrationLog(registration.eventId, registration.id);
      setRegistrationLog(response);
    } catch (err: any) {
      // Keep the UI usable with a local fallback timeline when API log data is unavailable.
      if (registration?.registrationDate && registration?.status) {
        setRegistrationLog(createFallbackLog(registration));
      } else {
        const message = err.response?.data?.message || 'Failed to load application log';
        setLogError(message);
        setRegistrationLog(null);
      }
    } finally {
      setLogLoading(false);
    }
  };

  const closeLogModal = () => {
    setLogOpen(false);
    setSelectedRegistrationId(null);
    setLogError("");
    setRegistrationLog(null);
  };

  const getStatusChanges = (logs: RegistrationLogEvent[], submittedAt: string, currentStatus: string) => {
    const statusEvents = logs.filter((log) =>
      ['submitted', 'under_review', 'approved', 'rejected'].includes(log.eventType)
    );

    const hasSubmitted = statusEvents.some((log) => log.eventType === 'submitted');
    if (!hasSubmitted) {
      statusEvents.unshift({
        id: 'derived-submitted',
        registrationId: registrationLog?.registration.id || '',
        eventType: 'submitted',
        actorRole: 'student',
        actorName: 'Student',
        message: 'Application submitted',
        createdAt: submittedAt,
      });
    }

    if (statusEvents.length === 1 && currentStatus !== 'waitlisted') {
      statusEvents.push({
        id: 'derived-current-status',
        registrationId: registrationLog?.registration.id || '',
        eventType: currentStatus === 'confirmed' ? 'approved' : 'rejected',
        actorRole: 'system',
        actorName: 'System',
        message: `Current status: ${getStatusLabelFromRegistrationStatus(currentStatus)}`,
        createdAt: new Date().toISOString(),
      });
    }

    return statusEvents;
  };

  const renderLogItems = (items: RegistrationLogEvent[]) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">No records available.</p>;
    }

    return (
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{getLogEventLabel(item.eventType)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
            {(item as any).metadata?.comment && (
              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Comment:</span> {(item as any).metadata.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenLog(registration)}
                    disabled={logLoading && selectedRegistrationId === registration.id}
                  >
                    View log
                  </Button>
                  {registration.status === 'confirmed' && (
                    <Button
                      size="sm"
                      disabled={downloading === registration.id}
                      onClick={() => handleDownloadCertificate(registration)}
                      className="gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloading === registration.id ? "Generating..." : "Download certificate"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={logOpen} onOpenChange={(open) => (!open ? closeLogModal() : setLogOpen(true))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Application Log</DialogTitle>
            <DialogDescription>
              View submission info, status changes, admin actions, and system actions.
            </DialogDescription>
          </DialogHeader>

          {logLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading application log...</div>
          ) : logError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{logError}</div>
          ) : registrationLog ? (
            <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
              <section className="space-y-2 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">Application submission info</h3>
                <p className="text-sm text-muted-foreground">Application ID: {registrationLog.registration.id}</p>
                <p className="text-sm text-muted-foreground">Event name: {registrationLog.registration.eventName}</p>
                <p className="text-sm text-muted-foreground">
                  Submitted date &amp; time: {formatDateTime(registrationLog.registration.submittedAt)}
                </p>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">Status changes</h3>
                {renderLogItems(
                  getStatusChanges(
                    registrationLog.logs,
                    registrationLog.registration.submittedAt,
                    registrationLog.registration.status
                  )
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">Admin actions</h3>
                {renderLogItems(
                  registrationLog.logs.filter(
                    (log) =>
                      log.actorRole === 'admin' &&
                      ['approved', 'rejected', 'comment_added', 'certificate_uploaded'].includes(log.eventType)
                  )
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">System actions</h3>
                {renderLogItems(
                  registrationLog.logs.filter((log) =>
                    ['certificate_ready', 'email_sent', 'receipt_generated'].includes(log.eventType)
                  )
                )}
              </section>
            </div>
          ) : (
            <div className="py-8 text-sm text-muted-foreground">No application selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
