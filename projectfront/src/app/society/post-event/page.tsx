import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const reports = [
  {
    event: "Innovation Week",
    status: "Draft",
    due: "Jan 08",
  },
  {
    event: "Green Finance Symposium",
    status: "Submitted",
    due: "Jan 05",
  },
  {
    event: "Culture Night",
    status: "Approved",
    due: "Dec 31",
  },
];

export default function PostEventPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Post-event reporting"
        description="Submit expenses, attendance, and insights for final approval."
        actions={[{ label: "Download template", href: "#", variant: "outline" }]}
      />

      <SectionCard title="Reports" description="Admins can approve, return, or annotate these submissions.">
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.event} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{report.event}</p>
                  <p className="text-sm text-muted-foreground">Due {report.due}</p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {report.status}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <Button size="sm" variant="secondary">
                  Update
                </Button>
                <Button size="sm" variant="outline">
                  Submit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
