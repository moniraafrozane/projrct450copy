import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const costSections = [
  {
    title: "Venue-related costs",
    helper: "Hall rental, stage setup, permits",
  },
  {
    title: "Event setup & technical costs",
    helper: "Lighting, sound, livestream, equipment",
  },
  {
    title: "Food & catering costs",
    helper: "Snacks, meals, beverages",
  },
  {
    title: "Manpower costs",
    helper: "Volunteers, security, support staff",
  },
  {
    title: "Marketing costs",
    helper: "Posters, social, paid reach",
  },
  {
    title: "Documentation costs",
    helper: "Photography, video, post-production",
  },
  {
    title: "Accessories",
    helper: "Badges, banners, stationeries, contingencies",
  },
];

export default function NewBudgetPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Budget workspace"
        title="Create budget breakdown"
        description="Capture projected spend per category before sending to admin review."
        actions={[
          { label: "Back to budgets", href: "/society/budgets", variant: "outline" },
        ]}
      />

      <SectionCard
        title="Budget categories"
        description="Enter planned spend and short justification for each cost bucket."
        actions={
          <div className="flex gap-3">
            <Button variant="outline">Print summary</Button>
            <Button variant="secondary" asChild>
              <Link href="/society/budgets">Save draft</Link>
            </Button>
          </div>
        }
      >
        <div className="grid gap-5">
          {costSections.map((section) => (
            <div key={section.title} className="space-y-4 rounded-2xl border border-border/70 p-5">
              <div>
                <p className="text-base font-semibold text-foreground">{section.title}</p>
                <p className="text-sm text-muted-foreground">{section.helper}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Estimated amount (৳)
                  <input
                    className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
                    placeholder="e.g., 6,500"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Notes / justification
                  <input
                    className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
                    placeholder="Explain the spend"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" variant="outline">
                  Attach quotes
                </Button>
                <Button size="sm" variant="ghost">
                  Mark as optional
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Total budget"
        description="Auto-sum or manually adjust the overall projected spend."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Calculated total (৳)
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              placeholder="৳00,000"
              readOnly
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Override amount (৳)
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              placeholder="Enter custom total"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary">Generate PDF</Button>
          <Button variant="outline" asChild>
            <Link href="/society/budgets">Submit for approval</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
