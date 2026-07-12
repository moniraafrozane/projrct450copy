"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ApplicationStatus,
  BudgetBreakdownContent,
  BudgetBreakdownSection,
  SocietyApplication,
  applicationAPI,
} from "@/lib/api";

const STATUS_META: Record<
  ApplicationStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "accent" },
  under_review: { label: "Under review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  returned: { label: "Returned", variant: "warning" },
};

const TYPE_LABELS: Record<string, string> = {
  fund_withdrawal: "Fund Withdrawal",
  event_approval: "Event Approval",
  resource_request: "Resource Request",
  budget_breakdown: "Budget Breakdown",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [application, setApplication] = useState<SocietyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    const loadApplication = async () => {
      if (!id || typeof id !== "string") {
        setError("Invalid application id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await applicationAPI.getApplicationById(id);
        setApplication(res.application);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load application details");
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [id]);

  const canReview = application?.status === "submitted" || application?.status === "under_review";
  const statusMeta = application ? STATUS_META[application.status] : STATUS_META.submitted;

  const budgetContent = useMemo(
    () => ((application?.content || {}) as Partial<BudgetBreakdownContent>),
    [application]
  );

  const budgetSections = useMemo(
    () =>
      (Array.isArray(budgetContent.sections)
        ? budgetContent.sections
        : []) as BudgetBreakdownSection[],
    [budgetContent.sections]
  );

  const genericContent = useMemo(
    () =>
      ((application?.content && typeof application.content === "object"
        ? application.content
        : {}) as Record<string, unknown>),
    [application]
  );

  const getContentText = (key: string) => {
    const value = genericContent[key];
    if (value === null || value === undefined || value === "") {
      return "N/A";
    }
    return String(value);
  };

  const handleApprove = async () => {
    if (!application) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const res = await applicationAPI.approveApplication(application.id);
      setApplication(res.application);
      setMessage("Application approved successfully.");
    } catch (actionError: any) {
      setError(actionError.response?.data?.message || "Failed to approve application");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!application) return;
    const note = adminNote.trim();

    if (!note) {
      setError("Admin note is required to return an application.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const res = await applicationAPI.returnApplication(application.id, note);
      setApplication(res.application);
      setAdminNote("");
      setMessage("Application returned to society member.");
    } catch (actionError: any) {
      setError(actionError.response?.data?.message || "Failed to return application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Application review"
        description="View details before approving or returning a society submission."
        actions={[{ label: "Back to dashboard", href: "/admin", variant: "outline" }]}
      />

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard title="Submission overview" description="Identity, status, and high-level submission details.">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading application...</p>
        ) : !application ? (
          <p className="text-sm text-muted-foreground">Application not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[application.type] ?? application.type}
              </span>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Subject:</span> {application.subject}
              </p>
              <p>
                <span className="font-medium text-foreground">Created by:</span> {application.createdByName}
              </p>
              <p>
                <span className="font-medium text-foreground">Created at:</span> {formatDate(application.createdAt)}
              </p>
              <p>
                <span className="font-medium text-foreground">Updated at:</span> {formatDate(application.updatedAt)}
              </p>
            </div>

            {application.adminNotes && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Existing admin note</p>
                <p className="mt-1 whitespace-pre-wrap">{application.adminNotes}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {!loading && application?.type === "budget_breakdown" && (
        <SectionCard title="Budget details" description="Review full budget breakdown before action.">
          <div className="space-y-4">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Event:</span> {budgetContent.eventTitle || "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Date:</span>{" "}
                {budgetContent.eventDate
                  ? new Date(budgetContent.eventDate).toLocaleDateString("en-GB")
                  : "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Venue:</span> {budgetContent.eventVenue || "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Organizer:</span> {budgetContent.organizerName || "N/A"}
              </p>
            </div>

            {budgetSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No budget sections found.</p>
            ) : (
              <div className="space-y-3">
                {budgetSections.map((section, index) => (
                  <div key={`${section.key}-${index}`} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-foreground">{section.title}</p>
                      <p className="text-sm font-semibold text-foreground">
                        BDT {Number(section.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    {section.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{section.notes}</p>
                    )}
                    {section.optional && (
                      <p className="mt-2 text-xs text-muted-foreground">Marked as optional</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Calculated total:</span>{" "}
                BDT {Number(budgetContent.calculatedTotal || 0).toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-foreground">Final total:</span>{" "}
                BDT {Number(budgetContent.totalAmount || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {!loading && application?.type !== "budget_breakdown" && application && (
        <SectionCard title="Application content" description="Submitted data provided by the society member.">
          {application.type === "event_approval" && (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Application date:</span> {getContentText("applicationDate")}</p>
                <p><span className="font-medium text-foreground">Event title:</span> {getContentText("eventTitle")}</p>
                <p><span className="font-medium text-foreground">Proposed date:</span> {getContentText("proposedDate")}</p>
                <p><span className="font-medium text-foreground">Venue:</span> {getContentText("venue")}</p>
                <p><span className="font-medium text-foreground">Expected attendees:</span> {getContentText("expectedAttendees")}</p>
                <p><span className="font-medium text-foreground">Estimated budget:</span> {getContentText("budget")}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event description</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{getContentText("description")}</p>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Applicant name:</span> {getContentText("applicantName")}</p>
                <p><span className="font-medium text-foreground">Applicant position:</span> {getContentText("applicantPosition")}</p>
                <p><span className="font-medium text-foreground">Registration number:</span> {getContentText("registrationNumber")}</p>
                <p><span className="font-medium text-foreground">Phone number:</span> {getContentText("phoneNumber")}</p>
              </div>
            </div>
          )}

          {application.type === "fund_withdrawal" && (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Application date:</span> {getContentText("applicationDate")}</p>
                <p><span className="font-medium text-foreground">Addressed to:</span> {getContentText("recipientTitle")}</p>
                <p><span className="font-medium text-foreground">Through:</span> {getContentText("throughTitle")}</p>
                <p><span className="font-medium text-foreground">Event date:</span> {getContentText("eventDate")}</p>
                <p><span className="font-medium text-foreground">Event title:</span> {getContentText("eventTitle")}</p>
                <p><span className="font-medium text-foreground">Amount:</span> {getContentText("amount")}</p>
                <p><span className="font-medium text-foreground">Used for:</span> {getContentText("usedFor")}</p>
                <p><span className="font-medium text-foreground">Attachment note:</span> {getContentText("attachments")}</p>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <p><span className="font-medium text-foreground">Chief guest:</span> {getContentText("chiefGuestName")}</p>
                <p><span className="font-medium text-foreground">Designation:</span> {getContentText("chiefGuestDesignation")}</p>
                <p><span className="font-medium text-foreground">Organization:</span> {getContentText("chiefGuestOrganization")}</p>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Applicant name:</span> {getContentText("applicantName")}</p>
                <p><span className="font-medium text-foreground">Applicant position:</span> {getContentText("applicantPosition")}</p>
                <p><span className="font-medium text-foreground">Registration number:</span> {getContentText("registrationNumber")}</p>
                <p><span className="font-medium text-foreground">Phone number:</span> {getContentText("phoneNumber")}</p>
              </div>
            </div>
          )}

          {application.type === "resource_request" && (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Application date:</span> {getContentText("applicationDate")}</p>
                <p><span className="font-medium text-foreground">Resource type:</span> {getContentText("resourceType")}</p>
                <p><span className="font-medium text-foreground">Quantity:</span> {getContentText("quantity")}</p>
                <p><span className="font-medium text-foreground">Duration:</span> {getContentText("duration")}</p>
                <p><span className="font-medium text-foreground">Event reference:</span> {getContentText("eventReference")}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{getContentText("purpose")}</p>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium text-foreground">Applicant name:</span> {getContentText("applicantName")}</p>
                <p><span className="font-medium text-foreground">Applicant position:</span> {getContentText("applicantPosition")}</p>
                <p><span className="font-medium text-foreground">Registration number:</span> {getContentText("registrationNumber")}</p>
                <p><span className="font-medium text-foreground">Phone number:</span> {getContentText("phoneNumber")}</p>
              </div>
            </div>
          )}

          {![
            "event_approval",
            "fund_withdrawal",
            "resource_request",
          ].includes(application.type) && (
            <pre className="whitespace-pre-wrap break-all rounded-xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
              {JSON.stringify(application.content || {}, null, 2)}
            </pre>
          )}
        </SectionCard>
      )}

      {!loading && application && (
        <SectionCard title="Member notes" description="Notes added by society members for this submission.">
          {(application.memberNotes || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No member notes found.</p>
          ) : (
            <div className="space-y-3">
              {application.memberNotes.map((note, index) => (
                <div key={`${note.authorId}-${note.createdAt}-${index}`} className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">
                    {note.authorName} · {formatDate(note.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {!loading && application && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => router.push("/admin")}>Back</Button>
        </div>
      )}
    </div>
  );
}
