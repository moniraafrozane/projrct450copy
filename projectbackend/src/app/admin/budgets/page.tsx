import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/patterns/timeline";

const budgets = [
  {
    event: "Sustainability Hackathon",
    owner: "Finance Society",
    amount: "৳48,000",
    status: "Awaiting edits",
  },
  {
    event: "Health & Wellness Week",
    owner: "Student Affairs",
    amount: "৳22,000",
    status: "Approved",
  },
  {
    event: "Cultural Night",
    owner: "Arts Collective",
    amount: "৳31,500",
    status: "Returned",
  },
];

const workflow = [
  {
    title: "Member submitted revision",
    description: "Budget v3 uploaded with catering updates",
    timestamp: "Jan 03 · 13:15",
    status: "pending" as const,
  },
  {
    title: "Admin requested clarification",
    description: "Need invoice for A/V supplier",
    timestamp: "Jan 02 · 19:04",
    status: "warning" as const,
  },
  {
    title: "Budget approved",
    description: "Finance signed off with digital stamp",
    timestamp: "Jan 01 · 10:50",
    status: "success" as const,
  },
];

export default function AdminBudgetsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Budget governance"
        description="Approve, return, or edit society budgets while keeping timestamped dialogue."
      />

      <SectionCard title="Active budgets" description="High priority records with audit-ready history.">
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div key={budget.event} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{budget.event}</p>
                  <p className="text-sm text-muted-foreground">{budget.owner}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{budget.amount}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {budget.status}
                </span>
                <Button size="sm" variant="secondary">
                  Approve
                </Button>
                <Button size="sm" variant="outline">
                  Request edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Workflow timeline"
        description="Member submissions, admin feedback, revisions, and approvals in one audit-friendly flow."
      >
        <Timeline items={workflow} />
      </SectionCard>
    </div>
  );
}
