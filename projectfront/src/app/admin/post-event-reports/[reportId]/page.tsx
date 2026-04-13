"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Badge } from "@/components/ui/badge";
import { EventReport, EventReportStatus, postEventAPI } from "@/lib/postEventApi";

const STATUS_META: Record<
  EventReportStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "accent" },
  under_review: { label: "Under review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  returned: { label: "Returned", variant: "warning" },
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "N/A";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `BDT ${value.toLocaleString()}`;
}

export default function AdminPostEventReportDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const reportId = useMemo(() => {
    const raw = params?.reportId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const eventId = searchParams.get("eventId") || "";

  const [report, setReport] = useState<EventReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId || typeof reportId !== "string") {
        setError("Invalid report id.");
        setLoading(false);
        return;
      }

      if (!eventId) {
        setError("Missing event id. Please open this report from Financial Records.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await postEventAPI.getReport(eventId, reportId);
        setReport(response.report);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load report details.");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [eventId, reportId]);

  const statusMeta = report ? STATUS_META[report.status] : STATUS_META.submitted;

  const planned = report?.eventInsights?.budgetPlannedTotal;
  const actual = report?.eventInsights?.budgetActualTotal;
  const hasVariance = typeof planned === "number" && typeof actual === "number";
  const variance = hasVariance ? actual - planned : null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Post-event report"
        description="Review the full submitted report details from financial records."
        actions={[{ label: "Back to financial records", href: "/admin/financial-records", variant: "outline" }]}
      />

      {loading ? (
        <SectionCard title="Loading" description="Fetching post-event report details.">
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </SectionCard>
      ) : error ? (
        <SectionCard title="Unable to load report" description="Please verify the report link and try again.">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
          <div className="mt-4">
            <Link href="/admin/financial-records" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Go back to financial records
            </Link>
          </div>
        </SectionCard>
      ) : !report ? (
        <SectionCard title="Report not found" description="No data was returned for this report.">
          <p className="text-sm text-muted-foreground">The report may have been deleted or you may not have access.</p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Report overview" description="Status and high-level event information.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                <span className="text-xs text-muted-foreground">Report ID: {report.id}</span>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Event:</span> {report.event?.title || "N/A"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Venue:</span> {report.event?.venue || "N/A"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Event date:</span> {formatDateTime(report.event?.eventDate)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Organizer:</span> {report.createdByName || "N/A"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Created at:</span> {formatDateTime(report.createdAt)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Updated at:</span> {formatDateTime(report.updatedAt)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Submitted at:</span> {formatDateTime(report.submittedAt)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Reviewed at:</span> {formatDateTime(report.reviewedAt)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Reviewed by:</span> {report.reviewedByName || "N/A"}
                </p>
              </div>

              {report.adminNotes ? (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Admin note</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.adminNotes}</p>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Attendance" description="Attendance summary and attendee list.">
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Total registered:</span>{" "}
                  {report.attendanceRecord?.totalRegistered ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Total attended:</span>{" "}
                  {report.attendanceRecord?.totalAttended ?? "N/A"}
                </p>
              </div>

              {!report.attendanceRecord?.attendeeList?.length ? (
                <p className="text-muted-foreground">No attendee list provided.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Attended</th>
                        <th className="px-4 py-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.attendanceRecord.attendeeList.map((entry, index) => (
                        <tr key={`${entry.name}-${index}`} className="border-t border-border/50">
                          <td className="px-4 py-2">{entry.name || "N/A"}</td>
                          <td className="px-4 py-2">{entry.email || "N/A"}</td>
                          <td className="px-4 py-2">{entry.attended ? "Yes" : "No"}</td>
                          <td className="px-4 py-2">{entry.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Insights and outcomes" description="Narrative report inputs from society members.">
            <div className="grid gap-4 text-sm">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key highlights</p>
                <p className="mt-2 whitespace-pre-wrap text-foreground">
                  {report.eventInsights?.keyHighlights || "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenges faced</p>
                <p className="mt-2 whitespace-pre-wrap text-foreground">
                  {report.eventInsights?.challengesFaced || "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Improvements suggested</p>
                <p className="mt-2 whitespace-pre-wrap text-foreground">
                  {report.eventInsights?.improvementsSuggested || "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall assessment</p>
                <p className="mt-2 whitespace-pre-wrap text-foreground">
                  {report.eventInsights?.overallAssessment || "N/A"}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Financial summary" description="Planned vs actual values captured in report insights.">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <p>
                <span className="font-medium text-foreground">Planned total:</span> {formatCurrency(planned)}
              </p>
              <p>
                <span className="font-medium text-foreground">Actual total:</span> {formatCurrency(actual)}
              </p>
              <p>
                <span className="font-medium text-foreground">Variance:</span>{" "}
                {variance === null ? "N/A" : `BDT ${variance.toLocaleString()}`}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expense notes</p>
              <p className="mt-2 whitespace-pre-wrap text-foreground">{report.expenseNotes || "N/A"}</p>
            </div>
          </SectionCard>

          <SectionCard title="Media" description="Files uploaded with this report.">
            {!report.media?.length ? (
              <p className="text-sm text-muted-foreground">No media files attached.</p>
            ) : (
              <div className="space-y-2">
                {report.media.map((file) => (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-border/70 px-4 py-3 text-sm hover:bg-muted/30"
                  >
                    <p className="font-medium text-foreground">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.mediaType} • {Math.round(file.fileSize / 1024)} KB • uploaded by {file.uploadedByName}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
