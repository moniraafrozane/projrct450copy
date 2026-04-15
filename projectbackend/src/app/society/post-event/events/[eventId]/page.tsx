"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Event, eventAPI } from "@/lib/api";
import {
  AttendanceRecord,
  BudgetComparison,
  EventReport,
  EventInsights,
  postEventAPI,
} from "@/lib/postEventApi";

function formatStatus(status: EventReport["status"]) {
  return status.replace("_", " ");
}

export default function PostEventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = params.eventId;

  const [event, setEvent] = useState<Event | null>(null);
  const [report, setReport] = useState<EventReport | null>(null);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison | null>(null);

  const [attendance, setAttendance] = useState<{
    totalRegistered: number | "";
    totalAttended: number | "";
    attendeeList: AttendanceRecord["attendeeList"];
  }>({
    totalRegistered: "",
    totalAttended: "",
    attendeeList: [],
  });
  const [insights, setInsights] = useState<EventInsights>({
    keyHighlights: "",
    challengesFaced: "",
    improvementsSuggested: "",
    overallAssessment: "",
  });
  const [expenseNotes, setExpenseNotes] = useState("");
  const [budgetInputs, setBudgetInputs] = useState<{ planned: number | ""; actual: number | "" }>({
    planned: "",
    actual: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reportIdFromQuery = searchParams.get("reportId");

  const canEdit = useMemo(() => {
    if (!report) return true;
    return report.status === "draft" || report.status === "returned";
  }, [report]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [eventRes, reportsRes, budgetRes] = await Promise.all([
        eventAPI.getEventById(eventId),
        postEventAPI.getReports(eventId),
        postEventAPI.getBudgetComparison(eventId),
      ]);

      setEvent(eventRes.event);
      setBudgetComparison(budgetRes.budgetComparison || null);

      const reports = reportsRes.reports || [];
      let selected = reports[0] || null;
      if (reportIdFromQuery) {
        const found = reports.find((r: EventReport) => r.id === reportIdFromQuery);
        if (found) selected = found;
      }

      if (selected) {
        setReport(selected);
        setAttendance(
          selected.attendanceRecord || {
            totalRegistered: "",
            totalAttended: "",
            attendeeList: [],
          }
        );
        setInsights(
          selected.eventInsights || {
            keyHighlights: "",
            challengesFaced: "",
            improvementsSuggested: "",
            overallAssessment: "",
          }
        );
        setBudgetInputs({
          planned:
            selected.eventInsights?.budgetPlannedTotal !== null && selected.eventInsights?.budgetPlannedTotal !== undefined
              ? Number(selected.eventInsights.budgetPlannedTotal)
              : budgetRes?.budgetComparison?.planned?.total
                ? Number(budgetRes.budgetComparison.planned.total)
                : "",
          actual:
            selected.eventInsights?.budgetActualTotal !== null && selected.eventInsights?.budgetActualTotal !== undefined
              ? Number(selected.eventInsights.budgetActualTotal)
              : budgetRes?.budgetComparison?.actual?.total
                ? Number(budgetRes.budgetComparison.actual.total)
                : "",
        });
        setExpenseNotes(selected.expenseNotes || "");
      } else {
        setReport(null);
        setBudgetInputs({
          planned: budgetRes?.budgetComparison?.planned?.total ? Number(budgetRes.budgetComparison.planned.total) : "",
          actual: budgetRes?.budgetComparison?.actual?.total ? Number(budgetRes.budgetComparison.actual.total) : "",
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load event report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    load();
  }, [eventId]);

  const createReportIfMissing = async () => {
    if (report) return report;
    const created = await postEventAPI.createReport(eventId);
    setReport(created.report);
    router.replace(`/society/post-event/events/${eventId}?reportId=${created.report.id}`);
    return created.report;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const activeReport = await createReportIfMissing();
      const res = await postEventAPI.updateReport(eventId, activeReport.id, {
        attendanceRecord: {
          totalRegistered: Number(attendance.totalRegistered) || 0,
          totalAttended: Number(attendance.totalAttended) || 0,
          attendeeList: [],
        },
        eventInsights: {
          ...insights,
          budgetPlannedTotal: budgetInputs.planned === "" ? null : Number(budgetInputs.planned),
          budgetActualTotal: budgetInputs.actual === "" ? null : Number(budgetInputs.actual),
        },
        expenseNotes,
      });

      setReport(res.report);
      setMessage("Post-event report saved.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!report) {
        setError("Please save the report first.");
        return;
      }
      setSubmitting(true);
      setError("");
      setMessage("");

      const res = await postEventAPI.submitReport(eventId, report.id);
      setReport(res.report);
      setMessage("Report submitted for admin review.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Post-event"
        title={event ? `${event.title} — Report` : "Post-event report"}
        description="Add Attendance, Expense notes, Event Insights, and review Planned vs Actual budget."
        actions={[
          { label: "← Back to post-event", href: "/society/post-event", variant: "outline" },
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading report...</p>
      ) : (
        <>
          <SectionCard
            title="Report status"
            description="Draft and returned reports are editable."
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {report ? formatStatus(report.status) : "not started"}
              </span>
              <Button onClick={handleSave} disabled={saving || !canEdit}>
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button variant="outline" onClick={handleSubmit} disabled={submitting || !report || !canEdit}>
                {submitting ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Attendance Record"
            description="Record total registered and attended participants."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Total registered</label>
                <Input
                  type="number"
                  min={0}
                  value={attendance.totalRegistered}
                  onChange={(e) =>
                    setAttendance((prev) => ({
                      ...prev,
                      totalRegistered: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Total attended</label>
                <Input
                  type="number"
                  min={0}
                  value={attendance.totalAttended}
                  onChange={(e) =>
                    setAttendance((prev) => ({
                      ...prev,
                      totalAttended: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Event Report / Insights"
            description="Add highlights, challenges, improvements, and final assessment."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Key highlights</label>
                <Textarea
                  value={insights.keyHighlights}
                  onChange={(e) => setInsights((prev: EventInsights) => ({ ...prev, keyHighlights: e.target.value }))}
                  disabled={!canEdit}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Challenges faced</label>
                <Textarea
                  value={insights.challengesFaced}
                  onChange={(e) => setInsights((prev: EventInsights) => ({ ...prev, challengesFaced: e.target.value }))}
                  disabled={!canEdit}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Improvements suggested</label>
                <Textarea
                  value={insights.improvementsSuggested}
                  onChange={(e) => setInsights((prev: EventInsights) => ({ ...prev, improvementsSuggested: e.target.value }))}
                  disabled={!canEdit}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Overall assessment</label>
                <Textarea
                  value={insights.overallAssessment}
                  onChange={(e) => setInsights((prev: EventInsights) => ({ ...prev, overallAssessment: e.target.value }))}
                  disabled={!canEdit}
                  rows={4}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Expense Submission Notes"
            description="Expense totals are derived from vouchers. Use this area for context/explanations."
          >
            <Textarea
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              disabled={!canEdit}
              rows={4}
              placeholder="Explain expense decisions, exceptions, or important notes..."
            />
          </SectionCard>

          <SectionCard
            title="Budget Comparison"
            description="Planned budget vs Actual expense compare from backend aggregation."
          >
            {!budgetComparison ? (
              <p className="text-sm text-muted-foreground">No budget comparison data available.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned</p>
                    <Input
                      type="number"
                      min={0}
                      value={budgetInputs.planned}
                      onChange={(e) =>
                        setBudgetInputs((prev) => ({
                          ...prev,
                          planned: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="Enter planned amount"
                      className="mt-2"
                    />
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual</p>
                    <Input
                      type="number"
                      min={0}
                      value={budgetInputs.actual}
                      onChange={(e) =>
                        setBudgetInputs((prev) => ({
                          ...prev,
                          actual: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="Enter actual amount"
                      className="mt-2"
                    />
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Variance</p>
                    <p className="mt-1 text-lg font-semibold">
                      {budgetInputs.planned === "" && budgetInputs.actual === ""
                        ? ""
                        : `BDT ${(
                            (budgetInputs.actual === "" ? 0 : Number(budgetInputs.actual)) -
                            (budgetInputs.planned === "" ? 0 : Number(budgetInputs.planned))
                          ).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                    <p className="mt-1 text-lg font-semibold">
                      {budgetInputs.planned === "" && budgetInputs.actual === ""
                        ? ""
                        : (budgetInputs.actual === "" ? 0 : Number(budgetInputs.actual)) -
                            (budgetInputs.planned === "" ? 0 : Number(budgetInputs.planned)) > 0
                          ? "Over budget"
                          : (budgetInputs.actual === "" ? 0 : Number(budgetInputs.actual)) -
                                (budgetInputs.planned === "" ? 0 : Number(budgetInputs.planned)) <
                              0
                            ? "Under budget"
                            : "On budget"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
