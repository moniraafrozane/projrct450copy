"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import {
  ApplicationStatus,
  applicationAPI,
  BudgetBreakdownContent,
  BudgetBreakdownSection,
  SocietyApplication,
} from "@/lib/api";

const statusLabel: Record<ApplicationStatus, string> = {
  draft: "Budget in Progress",
  submitted: "Awaiting Review",
  under_review: "Under Review",
  approved: "Budget Approved",
  returned: "Needs Revision",
};

const statusBadgeClass: Record<ApplicationStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  returned: "bg-rose-100 text-rose-700",
};

export default function BudgetDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [budget, setBudget] = useState<SocietyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBudget = async () => {
      if (!id || typeof id !== "string") {
        setError("Invalid budget id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await applicationAPI.getApplicationById(id);

        if (response.application.type !== "budget_breakdown") {
          setError("Requested record is not a budget breakdown");
          setBudget(null);
          return;
        }

        setBudget(response.application);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load budget");
      } finally {
        setLoading(false);
      }
    };

    loadBudget();
  }, [id]);

  const content = useMemo(
    () => ((budget?.content || {}) as Partial<BudgetBreakdownContent>),
    [budget]
  );

  const sections = useMemo(
    () => (Array.isArray(content.sections) ? content.sections : []) as BudgetBreakdownSection[],
    [content.sections]
  );

  const totalFromSections = useMemo(
    () => sections.reduce((sum, section) => sum + Number(section.amount || 0), 0),
    [sections]
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Budget workspace"
        title={content.eventTitle || budget?.subject || "Budget details"}
        description="Review the created budget breakdown, category notes, and total amount."
        actions={[{ label: "Back to budgets", href: "/society/budgets", variant: "outline" }]}
      />

      {error && (
        <div className="rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="Overview" description="Basic metadata for this budget breakdown.">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading budget...</p>
        ) : !budget ? (
          <p className="text-sm text-muted-foreground">Budget not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[budget.status]}`}>
                {statusLabel[budget.status]}
              </span>
              <span className="text-xs text-muted-foreground">
                Created by {budget.createdByName} on {new Date(budget.createdAt).toLocaleDateString("en-GB")}
              </span>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Event:</span> {content.eventTitle || "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Date:</span>{" "}
                {content.eventDate ? new Date(content.eventDate).toLocaleDateString("en-GB") : "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Time:</span> {content.eventStartTime || "N/A"}
              </p>
              <p>
                <span className="font-medium text-foreground">Venue:</span> {content.eventVenue || "N/A"}
              </p>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/society/budgets/new?edit=${budget.id}`}>Edit budget</a>
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {!loading && budget && (
        <SectionCard title="Budget sections" description="Projected spending by category.">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budget sections found.</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section, index) => (
                <div key={`${section.key}-${index}`} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{section.title}</p>
                      <p className="text-sm text-muted-foreground">{section.helper}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">BDT {Number(section.amount || 0).toLocaleString()}</p>
                  </div>
                  {section.notes && <p className="mt-3 text-sm text-muted-foreground">{section.notes}</p>}
                  {section.optional && (
                    <p className="mt-2 text-xs text-muted-foreground">Marked as optional</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {!loading && budget && (
        <SectionCard title="Total" description="Final amount saved in this budget draft.">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Calculated total:</span> BDT {Number(content.calculatedTotal || totalFromSections).toLocaleString()}
            </p>
            <p>
              <span className="font-medium text-foreground">Final total:</span> BDT {Number(content.totalAmount || totalFromSections).toLocaleString()}
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
