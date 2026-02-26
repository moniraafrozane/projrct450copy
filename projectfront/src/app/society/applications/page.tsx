import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const queue = [
  {
    student: "Ane",
    event: "AI & Ethics Forum",
    status: "Review",
    received: "Jan 03, 10:18",
  },
  {
    student: "Omar Rahman",
    event: "Innovation Week",
    status: "Ready",
    received: "Jan 02, 15:10",
  },
  {
    student: "Leila Khan",
    event: "Green Finance",
    status: "Need info",
    received: "Jan 02, 12:44",
  },
];

export default function SocietyApplicationsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Student applications"
        description="Receive applications, add context, and forward them to admins."
        actions={[
          {
            label: "Generate application",
            href: "/society/applications/new",
            variant: "accent",
          },
        ]}
      />

      <SectionCard
        title="Forwarding board"
        description="Stimulus/response: member reviews → attaches notes → forwards to admin."
      >
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.student} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{item.student}</p>
                  <p className="text-sm text-muted-foreground">{item.event}</p>
                </div>
                <Badge variant={item.status === "Ready" ? "success" : item.status === "Need info" ? "warning" : "accent"}>
                  {item.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Received {item.received}</span>
                <Button variant="outline" size="sm">
                  Add notes
                </Button>
                <Button variant="outline" size="sm">
                  Print
                </Button>
                <Button size="sm">Forward to admin</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
