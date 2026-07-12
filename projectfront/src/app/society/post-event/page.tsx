"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Event, eventAPI } from "@/lib/api";
import { EventReport, postEventAPI } from "@/lib/postEventApi";

type ReportMap = Record<string, EventReport>;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  return fallback;
}

function pickPreferredReport(current: EventReport | undefined, candidate: EventReport) {
  if (!current) return candidate;

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
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load post-event reporting data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateReport = async (eventId: string) => {
    try {
      setCreatingForEventId(eventId);
      setError("");
      setMessage("");
      const response = await postEventAPI.createReport(eventId);
      const reportId = response.report.id;
      router.push(`/society/post-event/events/${eventId}?reportId=${reportId}`);
    } catch (err: unknown) {
      const existingReportId =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { data?: { existingReportId?: string } } }).response?.data
          ?.existingReportId;
      if (existingReportId) {
        router.push(`/society/post-event/events/${eventId}?reportId=${existingReportId}`);
        return;
      }
      setError(getErrorMessage(err, "Failed to create report"));
    } finally {
      setCreatingForEventId(null);
    }
  };

  const handleViewReport = async (event: Event, report: EventReport) => {
    try {
      setDownloadingReportId(report.id);
      setError("");
      setMessage("");

      await postEventAPI.downloadReportExcel(event.id, report.id, event.title);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to download report"));
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Post-event reporting"
        description="Submit Expense, Attendance and Insights of the events."
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
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(report.status)}`}
                          >
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
                      {report ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/society/post-event/events/${event.id}?reportId=${report.id}`
                              )
                            }
                          >
                            Edit Report
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleViewReport(event, report)}
                            disabled={downloadingReportId === report.id}
                          >
                            {downloadingReportId === report.id ? "Opening..." : "View Report"}
                          </Button>
                        </>
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
