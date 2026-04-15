"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Event, eventAPI } from "@/lib/api";
import { EventReport, postEventAPI } from "@/lib/postEventApi";
import { PendingCertificate, certificateAPI } from "@/lib/certificateApi";

type ReportMap = Record<string, EventReport>;
type CertificateMap = Record<string, PendingCertificate[]>;

function reportPriority(report: EventReport) {
  if (report.status === "draft") return 3;
  if (report.status === "returned") return 2;
  return 1;
}

function pickPreferredReport(current: EventReport | undefined, candidate: EventReport) {
  if (!current) return candidate;

  const currentPriority = reportPriority(current);
  const candidatePriority = reportPriority(candidate);

  if (candidatePriority > currentPriority) return candidate;
  if (candidatePriority < currentPriority) return current;

  return new Date(candidate.updatedAt).getTime() >= new Date(current.updatedAt).getTime()
    ? candidate
    : current;
}

function isEventCompleted(eventDate: string): boolean {
  return new Date(eventDate).getTime() < Date.now();
}

function statusBadgeClass(status: EventReport["status"]) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "submitted" || status === "under_review") return "bg-blue-100 text-blue-700";
  if (status === "returned") return "bg-amber-100 text-amber-700";
  return "bg-secondary text-secondary-foreground";
}

export default function PostEventPage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [reportsByEvent, setReportsByEvent] = useState<ReportMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [creatingForEventId, setCreatingForEventId] = useState<string | null>(null);
  const [downloadingForEventId, setDownloadingForEventId] = useState<string | null>(null);
  const [certificatesByEvent, setCertificatesByEvent] = useState<CertificateMap>({});
  const [uploadingCertificate, setUploadingCertificate] = useState<string | null>(null);
  const [approvingCertificate, setApprovingCertificate] = useState<string | null>(null);
  const [rejectingCertificate, setRejectingCertificate] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const da = new Date(a.eventDate).getTime();
      const db = new Date(b.eventDate).getTime();
      return db - da;
    });
  }, [events]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [eventsRes, reportsRes] = await Promise.all([
        eventAPI.getManageableEvents(),
        postEventAPI.getAllReports(),
      ]);

      const fetchedEvents = eventsRes.events || [];
      const reportMap: ReportMap = {};
      for (const r of reportsRes.reports || []) {
        reportMap[r.eventId] = pickPreferredReport(reportMap[r.eventId], r);
      }

      setEvents(fetchedEvents);
      setReportsByEvent(reportMap);

      // Fetch pending certificates for all events
      const certMap: CertificateMap = {};
      for (const event of fetchedEvents) {
        try {
          const certRes = await certificateAPI.getPendingCertificates(event.id);
          if (certRes.pendingCertificates && certRes.pendingCertificates.length > 0) {
            certMap[event.id] = certRes.pendingCertificates;
          }
        } catch (err) {
          console.error(`Failed to fetch certificates for event ${event.id}:`, err);
        }
      }
      setCertificatesByEvent(certMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load post-event reporting data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDownloadTemplate = async () => {
    try {
      setError("");
      setMessage("");

      await postEventAPI.downloadGenericTemplate();
      setMessage("Post-event template downloaded successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to download template");
    }
  };

  const handleDownloadReport = async (eventId: string, reportId: string, eventTitle: string) => {
    try {
      setDownloadingForEventId(eventId);
      setError("");
      setMessage("");
      await postEventAPI.downloadReportPdf(eventId, reportId, eventTitle);
      setMessage("Report downloaded successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to download report");
    } finally {
      setDownloadingForEventId(null);
    }
  };

  const handleCreateReport = async (eventId: string) => {
    try {
      setCreatingForEventId(eventId);
      setError("");
      setMessage("");
      const response = await postEventAPI.createReport(eventId);
      const reportId = response.report.id;
      router.push(`/society/post-event/events/${eventId}?reportId=${reportId}`);
    } catch (err: any) {
      const existingReportId = err?.response?.data?.existingReportId;
      if (existingReportId) {
        router.push(`/society/post-event/events/${eventId}?reportId=${existingReportId}`);
        return;
      }
      setError(err?.response?.data?.message || "Failed to create report");
    } finally {
      setCreatingForEventId(null);
    }
  };

  const handleUploadCertificate = async (
    eventId: string,
    registrationId: string,
    file: File
  ) => {
    try {
      const certificateId = `${eventId}-${registrationId}`;
      setUploadingCertificate(certificateId);
      setError("");
      setMessage("");

      const response = await certificateAPI.uploadCertificate(eventId, registrationId, file);
      setMessage("Certificate uploaded successfully. Now click 'Forward to Student' to approve.");

      // Refresh certificates for this event
      const certRes = await certificateAPI.getPendingCertificates(eventId);
      const newCertMap = { ...certificatesByEvent };
      if (certRes.pendingCertificates && certRes.pendingCertificates.length > 0) {
        newCertMap[eventId] = certRes.pendingCertificates;
      } else {
        delete newCertMap[eventId];
      }
      setCertificatesByEvent(newCertMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to upload certificate");
    } finally {
      setUploadingCertificate(null);
    }
  };

  const handleApproveCertificate = async (eventId: string, registrationId: string) => {
    try {
      const certificateId = `${eventId}-${registrationId}`;
      setApprovingCertificate(certificateId);
      setError("");
      setMessage("");

      const response = await certificateAPI.approveCertificate(eventId, registrationId);
      setMessage(response.notificationMessage || "Certificate approved and student notified.");

      // Refresh certificates for this event
      const certRes = await certificateAPI.getPendingCertificates(eventId);
      const newCertMap = { ...certificatesByEvent };
      if (certRes.pendingCertificates && certRes.pendingCertificates.length > 0) {
        newCertMap[eventId] = certRes.pendingCertificates;
      } else {
        delete newCertMap[eventId];
      }
      setCertificatesByEvent(newCertMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to approve certificate");
    } finally {
      setApprovingCertificate(null);
    }
  };

  const handleRejectCertificate = async (eventId: string, registrationId: string) => {
    try {
      const certificateId = `${eventId}-${registrationId}`;
      setRejectingCertificate(certificateId);
      setError("");
      setMessage("");

      const response = await certificateAPI.rejectCertificate(eventId, registrationId);
      setMessage(response.message || "Certificate request rejected.");

      // Refresh certificates for this event
      const certRes = await certificateAPI.getPendingCertificates(eventId);
      const newCertMap = { ...certificatesByEvent };
      if (certRes.pendingCertificates && certRes.pendingCertificates.length > 0) {
        newCertMap[eventId] = certRes.pendingCertificates;
      } else {
        delete newCertMap[eventId];
      }
      setCertificatesByEvent(newCertMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reject certificate request");
    } finally {
      setRejectingCertificate(null);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Post-event reporting"
        description="Download template and submit Expense, Attendance, and Insights of the events."
        actions={[
          { label: "Download template", onClick: handleDownloadTemplate, variant: "outline" },
        ]}
      />

      {message && (
        <div className="rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Certificate Applications Card */}
      {!loading && Object.keys(certificatesByEvent).length > 0 && (
        <SectionCard
          title="Certificate Applications"
          description="Manage certificate applications from students. Upload the certificate PDF and forward it to the student."
        >
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const certificates = certificatesByEvent[event.id];
              if (!certificates || certificates.length === 0) return null;

              const dateLabel = event.eventDate
                ? new Date(event.eventDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "";

              return (
                <div key={`cert-${event.id}`} className="space-y-3">
                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-4">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateLabel} • {event.venue}
                    </p>
                  </div>

                  {certificates.map((cert) => {
                    const certificateId = `${event.id}-${cert.id}`;
                    const isUploading = uploadingCertificate === certificateId;
                    const isApproving = approvingCertificate === certificateId;
                    const isRejecting = rejectingCertificate === certificateId;

                    return (
                      <div
                        key={cert.id}
                        className="ml-4 rounded-lg border border-border/50 p-4"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium text-foreground">{cert.userName}</p>
                              <p className="text-sm text-muted-foreground">{cert.userEmail}</p>
                              {cert.registrationNumber && (
                                <p className="text-xs text-muted-foreground">
                                  Registration: {cert.registrationNumber}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Attendance: {cert.attended ? "Attended" : "Not attended"}
                              </p>
                            </div>
                            <div className="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                              {new Date(cert.certificateRequestedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {!cert.certificateFileUrl && (
                              <>
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  id={`cert-upload-${cert.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUploadCertificate(event.id, cert.id, file);
                                      // Reset input
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isUploading}
                                  className="hidden"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    document
                                      .getElementById(`cert-upload-${cert.id}`)
                                      ?.click()
                                  }
                                  disabled={isUploading}
                                >
                                  {isUploading ? "Uploading..." : "Upload Certificate"}
                                </Button>
                              </>
                            )}

                            <Button
                              size="sm"
                              onClick={() => handleApproveCertificate(event.id, cert.id)}
                              disabled={!cert.certificateFileUrl || isApproving}
                            >
                              {isApproving ? "Approving..." : "Approve"}
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectCertificate(event.id, cert.id)}
                              disabled={isRejecting}
                            >
                              {isRejecting ? "Rejecting..." : "Reject"}
                            </Button>

                            {cert.certificateFileUrl && (
                              <span className="flex items-center text-xs text-green-600">
                                ✓ File uploaded
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Event reports"
        description="Any society member can create/update the post-event report for an event."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading events and reports...</p>
        ) : sortedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manageable events found.</p>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const report = reportsByEvent[event.id];
              const completed = isEventCompleted(event.eventDate);
              const dateLabel = event.eventDate
                ? new Date(event.eventDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "";

              return (
                <div key={event.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {dateLabel} • {event.venue}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {report ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(report.status)}`}>
                            {report.status.replace("_", " ")}
                          </span>
                        ) : completed ? (
                          <span className="rounded-full px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700">
                            completed
                          </span>
                        ) : (
                          <span className="rounded-full px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground">
                            upcoming
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => report && handleDownloadReport(event.id, report.id, event.title)}
                        disabled={downloadingForEventId === event.id || !report}
                      >
                        {downloadingForEventId === event.id
                          ? "Downloading..."
                          : report
                            ? "Download Report PDF"
                            : "No report yet"}
                      </Button>

                      {report ? (
                        <Button size="sm" asChild>
                          <Link href={`/society/post-event/events/${event.id}?reportId=${report.id}`}>Update Report</Link>
                        </Button>
                      ) : completed ? (
                        <Button
                          size="sm"
                          onClick={() => handleCreateReport(event.id)}
                          disabled={creatingForEventId === event.id}
                        >
                          {creatingForEventId === event.id ? "Creating..." : "Create Report"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Not completed yet
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
