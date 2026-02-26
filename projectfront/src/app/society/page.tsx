import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";


const tasks = [
  {
    title: "Finalize Innovation Week budget",
    detail: "Admin requested revised equipment split",
    cta: "Edit budget",
  },
  {
    title: "Forward 5 pending student applications",
    detail: "Ensure comments before 5 PM",
    cta: "Review queue",
  },
  {
    title: "Submit post-event report",
    detail: "Green finance symposium",
    cta: "Upload report",
  },
];

export default function SocietyDashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Society mission control"
        description="Start workflows, collaborate with admins, and keep every action documented."
      />

      <SectionCard title="Priority tasks">
        <div className="grid gap-4">
          {tasks.map((task) => (
            <div key={task.title} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">{task.title}</p>
                <p className="text-sm text-muted-foreground">{task.detail}</p>
              </div>
              <Button variant="secondary">{task.cta}</Button>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
