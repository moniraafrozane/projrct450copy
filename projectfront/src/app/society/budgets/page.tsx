"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { ApplicationStatus, SocietyApplication, applicationAPI } from "@/lib/api";

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

export default function SocietyBudgetsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [budgets, setBudgets] = useState<SocietyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("edited") !== "1") {
      return;
    }

    setActionMessage("budget has been edited");

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("edited");
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        setLoading(true);
        const response = await applicationAPI.getBudgetBreakdowns();
        setBudgets(response.applications || []);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load budgets");
      } finally {
        setLoading(false);
      }
    };

    loadBudgets();
  }, []);

  const submitDraft = async (id: string) => {
    try {
      setSubmittingId(id);
      setError("");
      setActionMessage("");
      await applicationAPI.submitApplication(id);
      setBudgets((prev) =>
        prev.map((budget) => (budget.id === id ? { ...budget, status: "submitted" } : budget))
      );
      setActionMessage("Budget submitted to admin for review");
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || "Failed to submit budget");
    } finally {
      setSubmittingId(null);
    }
  };

  const items = useMemo(() => budgets, [budgets]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Budget workspace"
        description="Create, prepare, revise, and resubmit budgets before admin approval."
        actions={[{ label: "New budget", href: "/society/budgets/new" }]}
      />

      {actionMessage && (
        <div className="rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionMessage}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="created budget" description="Track status and version history at a glance.">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading budgets...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets created yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((budget) => {
              const content = budget.content || {};
              const eventTitle = content.eventTitle || "Untitled Event";
              const totalAmount = Number(content.totalAmount || 0);
              const sectionCount = Array.isArray(content.sections) ? content.sections.length : 0;

              return (
                <div key={budget.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{eventTitle}</p>
                      <p className="text-sm text-muted-foreground">{sectionCount} budget sections</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">BDT {totalAmount.toLocaleString()}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[budget.status]}`}>
                      {statusLabel[budget.status]}
                    </span>

                    <Button variant="outline" size="sm" asChild>
                      <a href={`/society/budgets/${budget.id}`}>View</a>
                    </Button>

                    <Button variant="outline" size="sm" asChild>
                      <a href={`/society/budgets/new?edit=${budget.id}`}>Edit</a>
                    </Button>

                    {budget.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => submitDraft(budget.id)}
                        disabled={submittingId === budget.id}
                      >
                        {submittingId === budget.id ? "Submitting..." : "Share with admin"}
                      </Button>
                    )}
                  </div>

                  {budget.status === "returned" && budget.adminNotes && (
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Admin note</p>
                      <p className="mt-1 whitespace-pre-wrap">{budget.adminNotes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
