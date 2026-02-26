import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const reportBlocks = [
  {
    title: "Student count",
    value: "8,420",
    detail: "+4.2% vs last term",
  },
  {
    title: "Event statistics",
    value: "63",
    detail: "Upcoming within 60 days",
  },
  {
    title: "Budget summaries",
    value: "৳1.2M",
    detail: "Approved for Q1",
  },
  {
    title: "Financial monitoring",
    value: "12",
    detail: "Records flagged",
  },
];

const budgetTimeline = [
  { month: "Jan", amount: 120 },
  { month: "Feb", amount: 95 },
  { month: "Mar", amount: 140 },
  { month: "Apr", amount: 110 },
  { month: "May", amount: 150 },
  { month: "Jun", amount: 130 },
];

const maxBudgetValue = Math.max(...budgetTimeline.map((point) => point.amount));

export default function AdminReportsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics & exports"
        description="Generate analytical reports on students, events, budgets, and finances."
        actions={[{ label: "Export PDF", href: "#" }]}
      />

      <SectionCard title="Snapshots" description="Quick metrics rendered via charts/widgets.">
        <div className="grid gap-4 md:grid-cols-2">
          {reportBlocks.map((block) => (
            <div key={block.title} className="rounded-2xl border border-border/70 p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{block.title}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{block.value}</p>
              <p className="text-sm text-muted-foreground">{block.detail}</p>
            </div>
          ))}
        </div>
        <Button variant="secondary">Configure dashboards</Button>
      </SectionCard>

      <SectionCard
        title="Budget summary timeline"
        description="Budget totals plotted by month (in ৳K)."
      >
        <div className="flex items-end gap-4 overflow-x-auto pb-2">
          {budgetTimeline.map((point) => (
            <div key={point.month} className="flex flex-col items-center gap-2 text-xs">
              <div
                className="w-8 rounded-2xl bg-primary/80"
                style={{ height: `${((point.amount / maxBudgetValue) * 160).toFixed(2)}px` }}
                title={`${point.month}: ৳${point.amount}k`}
              />
              <span className="font-semibold text-foreground">৳{point.amount}k</span>
              <span className="text-muted-foreground">{point.month}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
