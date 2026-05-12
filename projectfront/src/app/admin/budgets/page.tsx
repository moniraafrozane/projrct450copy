"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/patterns/timeline";
import { applicationAPI, SocietyApplication } from "@/lib/api";

interface BudgetItem {
  id: string;
  event: string;
  owner: string;
  amount: string;
  status: string;
  applicationStatus: string;
  application: SocietyApplication;
}

function isStructuredBudgetBreakdown(app: SocietyApplication) {
  const content = app.content;
  return (
    app.type === "budget_breakdown" &&
    Boolean(
      content &&
        typeof content === "object" &&
        Array.isArray((content as { sections?: unknown[] }).sections)
    )
  );
}

export default function AdminBudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        setLoading(true);
        const response = await applicationAPI.getBudgetBreakdowns();
        
        if (response.success && response.applications) {
          // Filter for under_review, submitted, and approved statuses
          const filteredBudgets = response.applications
            .filter(
              (app) =>
                isStructuredBudgetBreakdown(app) &&
                ["under_review", "submitted", "approved", "returned"].includes(app.status)
            )
            .map(app => {
              const content = app.content as any;
              const totalAmount = content?.totalAmount || content?.calculatedTotal || 0;
              
              return {
                id: app.id,
                event: content?.eventTitle || "Unknown Event",
                owner: app.createdByName || "Unknown",
                amount: `৳${totalAmount?.toLocaleString('en-IN') || 0}`,
                status: formatStatus(app.status),
                applicationStatus: app.status,
                application: app,
              };
            });
          
          setBudgets(filteredBudgets);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load budgets");
        console.error("Failed to load budgets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBudgets();
  }, []);

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'under_review': 'Under Review',
      'submitted': 'Submitted',
      'approved': 'Approved',
      'returned': 'Returned for Edits',
      'draft': 'Draft',
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'under_review':
        return 'bg-blue-100 text-blue-800';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'returned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await applicationAPI.approveApplication(id);
      // Refresh the list
      const response = await applicationAPI.getBudgetBreakdowns();
      if (response.success && response.applications) {
        const filteredBudgets = response.applications
          .filter(
            (app) =>
              isStructuredBudgetBreakdown(app) &&
              ["under_review", "submitted", "approved", "returned"].includes(app.status)
          )
          .map(app => {
            const content = app.content as any;
            const totalAmount = content?.totalAmount || content?.calculatedTotal || 0;
            return {
              id: app.id,
              event: content?.eventTitle || "Unknown Event",
              owner: app.createdByName || "Unknown",
              amount: `৳${totalAmount?.toLocaleString('en-IN') || 0}`,
              status: formatStatus(app.status),
              applicationStatus: app.status,
              application: app,
            };
          });
        setBudgets(filteredBudgets);
      }
    } catch (err: any) {
      console.error("Failed to approve budget:", err);
      alert(err.message || "Failed to approve budget");
    }
  };

  const handleReturn = async (id: string) => {
    const adminNotes = prompt("Enter feedback for the society member:");
    if (adminNotes) {
      try {
        await applicationAPI.returnApplication(id, adminNotes);
        // Refresh the list
        const response = await applicationAPI.getBudgetBreakdowns();
        if (response.success && response.applications) {
          const filteredBudgets = response.applications
            .filter(
              (app) =>
                isStructuredBudgetBreakdown(app) &&
                ["under_review", "submitted", "approved", "returned"].includes(app.status)
            )
            .map(app => {
              const content = app.content as any;
              const totalAmount = content?.totalAmount || content?.calculatedTotal || 0;
              return {
                id: app.id,
                event: content?.eventTitle || "Unknown Event",
                owner: app.createdByName || "Unknown",
                amount: `৳${totalAmount?.toLocaleString('en-IN') || 0}`,
                status: formatStatus(app.status),
                applicationStatus: app.status,
                application: app,
              };
            });
          setBudgets(filteredBudgets);
        }
      } catch (err: any) {
        console.error("Failed to return budget:", err);
        alert(err.message || "Failed to return budget");
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Budget governance"
          description="Approve, return, or edit society budgets while keeping timestamped dialogue."
        />
        <SectionCard title="Budget Breakdown">
          <p className="text-muted-foreground">Loading budgets...</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Budget governance"
        description="Approve, return, or edit society budgets while keeping timestamped dialogue."
      />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <SectionCard 
        title="Budget Breakdown" 
        description={budgets.length === 0 ? "No budgets submitted for review" : `${budgets.length} budget(s) awaiting review`}
      >
        <div className="space-y-4">
          {budgets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No budgets have been submitted for review yet.
            </p>
          ) : (
            budgets.map((budget) => (
              <div key={budget.id} className="rounded-2xl border border-border/70 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{budget.event}</p>
                    <p className="text-sm text-muted-foreground">{budget.owner}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{budget.amount}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(budget.applicationStatus)}`}>
                    {budget.status}
                  </span>
                  {budget.applicationStatus === 'under_review' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleApprove(budget.id)}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleReturn(budget.id)}
                      >
                        Request edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
