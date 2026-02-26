import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const rows = [
  {
    id: "APP-3021",
    student: "Ane",
    event: "AI & Ethics Forum",
    submitted: "Jan 03, 10:24",
    status: "Pending",
  },
  {
    id: "APP-2980",
    student: "Omar Rahman",
    event: "Innovation Week",
    submitted: "Jan 02, 15:44",
    status: "Approved",
  },
  {
    id: "APP-2964",
    student: "Jia Chen",
    event: "Green Finance",
    submitted: "Jan 02, 09:10",
    status: "Returned",
  },
];

export default function AdminApplicationsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Student applications"
        description="Approve or reject with comments and automatic Date & Time stamp."
        actions={[{ label: "View analytics", href: "/admin/reports", variant: "outline" }]}
      />

      <SectionCard title="Queue" description="Each decision records actor, comment, and timestamp.">
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Event</th>
                <th className="px-6 py-3">Submitted</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/50">
                  <td className="px-6 py-4 font-semibold text-foreground">{row.id}</td>
                  <td className="px-6 py-4">{row.student}</td>
                  <td className="px-6 py-4">{row.event}</td>
                  <td className="px-6 py-4 text-muted-foreground">{row.submitted}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        row.status === "Approved"
                          ? "success"
                          : row.status === "Returned"
                            ? "warning"
                            : "accent"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary">
                        Approve
                      </Button>
                      <Button size="sm" variant="outline">
                        Comment
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
