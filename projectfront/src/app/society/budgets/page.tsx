import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const budgets = [
  {
    title: "Innovation Week",
    version: "v3",
    status: "Awaiting admin",
    amount: "৳88,500",
  },
  {
    title: "Cultural Night",
    version: "v2",
    status: "Needs revision",
    amount: "৳31,500",
  },
  {
    title: "Health & Wellness",
    version: "v1",
    status: "Draft",
    amount: "৳22,000",
  },
];

export default function SocietyBudgetsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Budget workspace"
        description="Create, prepare, revise, and resubmit budgets before admin approval."
        actions={[{ label: "New budget", href: "/society/budgets/new" }]}
      />

      <SectionCard title="In progress" description="Track status and version history at a glance.">
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div key={budget.title} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{budget.title}</p>
                  <p className="text-sm text-muted-foreground">Version {budget.version}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{budget.amount}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {budget.status}
                </span>
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
                <Button size="sm" variant="outline">
                  Share with admin
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
