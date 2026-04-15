"use client";

import { useEffect, useState } from "react";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getBackendOrigin = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "http://localhost:5000";
  }
};

const resolveCertificateUrl = (certificateFileUrl?: string | null) => {
  if (!certificateFileUrl) return null;
  if (/^https?:\/\//i.test(certificateFileUrl)) return certificateFileUrl;
  return `${getBackendOrigin()}${certificateFileUrl.startsWith('/') ? '' : '/'}${certificateFileUrl}`;
};

export default function StudentApplicationsPage() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [societyEvents, setSocietyEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [applyingForCertificate, setApplyingForCertificate] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [registrationLog, setRegistrationLog] = useState<RegistrationLogResponse | null>(null);

  useEffect(() => {
    fetchPageData();
  }, []);

  const fetchRegistrations = async () => {
    try {
      const response = await eventAPI.getMyRegistrations();
      setRegistrations(Array.isArray(response.registrations) ? response.registrations : []);
    } catch (err: any) {
      console.error("Failed to fetch registrations:", err);
      setRegistrations([]);
      throw err;
    }
  };

  const fetchSocietyEvents = async () => {
    try {
      const response = await eventAPI.getSocietyEvents({ page: 1, limit: 300 });
      const events = Array.isArray(response.events) ? response.events : [];
      setSocietyEvents(events);
    } catch (err: any) {
      console.error("Failed to load society events:", err);
      setSocietyEvents([]);
      throw err;
    }
  };

  const fetchPageData = async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([fetchRegistrations(), fetchSocietyEvents()]);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load certificate and history data");
    } finally {
      setLoading(false);
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

  const getCertificateStatusBadgeVariant = (certificateStatus?: string) => {
    switch (certificateStatus) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getCertificateStatusLabel = (certificateStatus?: string) => {
    switch (certificateStatus) {
      case 'approved':
        return 'Certificate approved';
      case 'pending':
        return 'Certificate pending';
      case 'rejected':
        return 'Certificate rejected';
      default:
        return 'Certificate not requested';
    }
  };

  const handleDownloadCertificate = async (registration: any) => {
    try {
      setDownloading(registration.id);

      if (registration.certificateRequestStatus === 'approved' && registration.certificateFileUrl) {
        const fileUrl = resolveCertificateUrl(registration.certificateFileUrl);
        if (!fileUrl) {
          alert('Certificate file is not available yet. Please try again later.');
          return;
        }

        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = `${registration.event?.title || 'certificate'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      if (registration.certificateRequestStatus !== 'approved') {
        alert('Certificate is not approved yet. Please wait for approval.');
        return;
      }

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

  const handleApplyForCertificate = async (registration: any) => {
    const resolvedEventId = registration?.eventId || registration?.event?.id;

    if (!resolvedEventId) {
      alert('Missing event information for this registration.');
      return;
    }

    if (registration.status !== 'confirmed') {
      alert('Certificate can only be requested for approved registrations.');
      return;
    }

    if (registration.certificateRequestStatus === 'pending') {
      alert('Certificate request is already pending.');
      return;
    }

    if (registration.certificateRequestStatus === 'approved') {
      alert('Certificate request has already been approved.');
      return;
    }

    try {
      setApplyingForCertificate(registration.id);
      const response = await eventAPI.applyForCertificate(resolvedEventId, registration.id);
      alert(response.message || 'Certificate application submitted successfully');
      await fetchPageData();
      if (selectedRegistrationId === registration.id) {
        await handleOpenLog(registration);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to submit certificate application';
      alert(message);
    } finally {
      setApplyingForCertificate(null);
    }
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
      case 'attendance_marked':
        return 'Attendance marked';
      case 'certificate_requested':
        return 'Certificate requested';
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

  const handleOpenLog = async (registration: any) => {
    setSelectedRegistrationId(registration.id);
    setLogOpen(true);
    setLogError("");
    setLogLoading(true);

    if (!registration.eventId) {
      setLogError('Missing event information for this registration');
      setRegistrationLog(null);
      setLogLoading(false);
      return;
    }

    try {
      const response = await eventAPI.getRegistrationLog(registration.eventId, registration.id);
      setRegistrationLog(response);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load application log';
      setLogError(message);
      setRegistrationLog(null);
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
    if (registration.certificateRequestStatus === 'pending') {
      return 'Certificate request pending review';
    } else if (registration.certificateRequestStatus === 'approved') {
      return 'Certificate request approved';
    } else if (registration.certificateRequestStatus === 'rejected') {
      return 'Certificate request rejected';
    }

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

  const getCertificateRequestLabel = (registration: any) => {
    if (registration.certificateRequestStatus === 'pending') return 'Request pending';
    if (registration.certificateRequestStatus === 'approved') return 'Request approved';
    return 'Apply for certificate';
  };

  const isCertificateApplyDisabled = (registration: any) => applyingForCertificate === registration.id;

  const registrationByEventId = new Map(
    registrations
      .filter((registration) => registration?.eventId)
      .map((registration) => [registration.eventId, registration])
  );

  return (
    <div className="space-y-10">
      <SectionCard
        title="Certificate & history"
        description="See certificates and registration timelines for society-created events you joined."
      >
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading society events...</div>
        ) : societyEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No society-created events found.</div>
        ) : (
          <div className="space-y-4">
            {societyEvents.map((event) => {
              const registration = registrationByEventId.get(event.id);
              const isRegistered = Boolean(registration);
              const canDownloadCertificate =
                isRegistered &&
                registration.status === 'confirmed' &&
                registration.certificateRequestStatus === 'approved' &&
                Boolean(registration.certificateFileUrl);
              const downloadBlockReason = !isRegistered
                ? 'You are not registered for this event.'
                : registration.status !== 'confirmed'
                  ? 'Registration must be approved before certificate download.'
                  : registration.certificateRequestStatus !== 'approved'
                    ? 'Certificate request must be approved first.'
                    : !registration.certificateFileUrl
                      ? 'Certificate file is not uploaded yet.'
                      : '';

              return (
              <div key={event.id} className="rounded-2xl border border-border/70 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {event.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(event.eventDate)}
                    </p>
                    <p className="text-sm text-muted-foreground">{event.venue}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {isRegistered ? (
                      <Badge variant={getCertificateStatusBadgeVariant(registration.certificateRequestStatus)}>
                        {getCertificateStatusLabel(registration.certificateRequestStatus)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not registered</Badge>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{isRegistered ? getStatusMessage(registration) : "You are not registered for this event."}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => isRegistered && handleOpenLog(registration)}
                    disabled={!isRegistered || (logLoading && selectedRegistrationId === registration.id)}
                  >
                    View log
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => isRegistered && handleApplyForCertificate(registration)}
                    disabled={!isRegistered || isCertificateApplyDisabled(registration)}
                  >
                    {isRegistered
                      ? applyingForCertificate === registration.id
                        ? 'Applying...'
                        : getCertificateRequestLabel(registration)
                      : 'Apply for certificate'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canDownloadCertificate || downloading === registration.id}
                    onClick={() => isRegistered && handleDownloadCertificate(registration)}
                    className="gap-1.5"
                    title={canDownloadCertificate ? 'Download certificate' : downloadBlockReason}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {isRegistered && downloading === registration.id ? "Downloading..." : "Download certificate"}
                  </Button>
                  {!canDownloadCertificate && (
                    <span className="text-xs text-muted-foreground">{downloadBlockReason}</span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <Dialog open={logOpen} onOpenChange={(open) => (!open ? closeLogModal() : setLogOpen(true))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Event Registration Log</DialogTitle>
            <DialogDescription>
              View the real event registration history, attendance timeline, and admin actions.
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
                  Registration date &amp; time: {formatDateTime(registrationLog.registration.registrationDateTime)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Certificate issue time: {registrationLog.registration.certificateIssueTime
                    ? formatDateTime(registrationLog.registration.certificateIssueTime)
                    : '--'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Registered: {registrationLog.registration.registered ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Attended / Absent: {registrationLog.registration.attendanceStatus}
                </p>
                <p className="text-sm text-muted-foreground">
                  Team / Solo participation: {registrationLog.registration.participationType}
                </p>
                <p className="text-sm text-muted-foreground">
                  Position: {registrationLog.registration.position || '--'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score / Marks: {registrationLog.registration.scoreOrMarks || '--'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Remarks: {registrationLog.registration.performanceRemarks || '--'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Certificate request: {registrationLog.registration.certificateRequestStatus
                    ? registrationLog.registration.certificateRequestStatus.replace(/_/g, ' ')
                    : '--'}
                  {registrationLog.registration.certificateRequestedAt
                    ? ` (${formatDateTime(registrationLog.registration.certificateRequestedAt)})`
                    : ''}
                </p>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">Attendance timeline</h3>
                {renderLogItems(
                  registrationLog.logs.filter((log) => ['attendance_marked'].includes(log.eventType))
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 p-4">
                <h3 className="text-sm font-semibold text-foreground">Admin actions</h3>
                {renderLogItems(
                  registrationLog.logs.filter(
                    (log) =>
                      log.actorRole === 'admin' &&
                      ['approved', 'rejected', 'comment_added', 'certificate_uploaded', 'attendance_marked'].includes(log.eventType)
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
