import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


const events = [
  {
    name: "Intra SUST Programming Contest",
    date: "Jan 10",
    registrationDeadline: "Register by Jan 05",
    eventType: "Competitive programming",
    status: "Open",
    cta: "Apply",
  },
  {
    name: "VisionX Robotics Competition",
    date: "Jan 22",
    registrationDeadline: "Register by Jan 15",
    eventType: "Robotics · Team",
    status: "Closing soon",
    cta: "Apply",
  },
  {
    name: "JavaFest",
    date: "Feb 03",
    registrationDeadline: "Register by Jan 28",
    eventType: "Developer summit",
    status: "Waitlist",
    cta: "Join waitlist",
  },
  {
    name: "IUT National ICT Fest",
    date: "Feb 18",
    registrationDeadline: "Register by Feb 10",
    eventType: "National tech festival",
    status: "Draft",
    cta: "Preview schedule",
  },
];

export default function StudentDashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Welcome back"
        description="Track your society submissions, keep tabs on approvals, and explore curated events."
      />

      <SectionCard
        title="Your upcoming events"
        description="Browse events, apply, and follow progress in one place."
      >
        <div className="grid gap-4">
          {events.map((event) => (
            <div
              key={event.name}
              className="flex flex-col gap-4 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-base font-semibold text-foreground">{event.name}</p>
                <p className="text-xl text-muted-foreground">{event.date}</p>
                <p className="text-lg text-muted-foreground">{event.eventType}</p>
                <p className="text-base text-muted-foreground/80">{event.registrationDeadline}</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Badge variant={event.status === "Open" ? "success" : event.status === "Waitlist" ? "warning" : "outline"}>
                  {event.status}
                </Badge>
                <Button variant="outline">{event.cta}</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Application & history module removed per request */}
    </div>
  );
}
