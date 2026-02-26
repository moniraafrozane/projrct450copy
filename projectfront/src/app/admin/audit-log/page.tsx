import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Timeline } from "@/components/patterns/timeline";

const audit = [
  {
    title: "ADM-488 closed student account",
    description: "Actor: Admin Vega • Reason: graduation",
    timestamp: "Jan 03 · 16:55",
    status: "danger" as const,
  },
  {
    title: "ADM-102 approved budget",
    description: "Event: Innovation Week",
    timestamp: "Jan 03 · 11:20",
    status: "success" as const,
  },
  {
    title: "ADM-301 sent feedback",
    description: "Student: Jia Chen",
    timestamp: "Jan 02 · 09:12",
    status: "pending" as const,
  },
];

export default function AuditLogPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Audit trail"
        description="Complete action log with name, actor, and Date & Time for every admin activity."
      />

      <SectionCard title="Recent actions" description="Export-ready evidence for compliance teams.">
        <Timeline items={audit} />
      </SectionCard>
    </div>
  );
}
