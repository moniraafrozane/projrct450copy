import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


const approvalQueue = [
  {
    id: "APP-3021",
    requester: "Ane",
    event: "AI & Ethics Forum",
    submitted: "Jan 03 · 10:24",
    amount: "৳28,400",
    urgency: "High",
  },
  {
    id: "APP-2980",
    requester: "Omar Rahman",
    event: "Innovation Week",
    submitted: "Jan 02 · 15:44",
    amount: "৳2,100",
    urgency: "Medium",
  },
];

const budgetBoard = [
  {
    title: "Sustainability Hackathon",
    owner: "Finance Society",
    amount: "৳48,000",
    status: "Awaiting edits",
  },
  {
    title: "Cultural Night",
    owner: "Arts Collective",
    amount: "৳31,500",
    status: "Returned",
  },
  {
    title: "Health & Wellness Week",
    owner: "Student Affairs",
    amount: "৳22,000",
    status: "Approved",
  },
];

const feedbackThreads = [
  {
    id: "FDB-118",
    recipient: "Green Finance Society",
    topic: "Budget revision guidance",
    status: "Draft",
  },
  {
    id: "FDB-117",
    recipient: "Ane",
    topic: "Application clarification",
    status: "Sent",
  },
];

const accountClosures = [
  { id: "STU-229", reason: "Duplicate accounts", requested: "Jan 02" },
  { id: "STU-214", reason: "Graduated", requested: "Jan 01" },
];


export default function AdminDashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Administrative operations hub"
        description="Enforce credential policies, route approvals, and govern every financial artifact with Date & Time precision."
        actions={[{ label: "Generate report", href: "/admin/reports" }]}
      />

      <SectionCard
        title="Sign-in oversight & approvals"
        description="Monitor credential compliance and approve or reject applications with a comment plus Date & Time stamp."
      >
        <div className="space-y-4">
          {approvalQueue.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{item.event}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.id} • {item.requester} • {item.submitted}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.urgency === "High" ? "destructive" : item.urgency === "Medium" ? "accent" : "outline"}>
                    {item.urgency} urgency
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{item.amount}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <textarea
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                  placeholder="Add decision comment (required)"
                />
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm">
                    Approve
                  </Button>
                  <Button className="flex-1" size="sm" variant="outline">
                    Request edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Budget governance"
        description="Approve, return, or edit budgets submitted by society members with full traceability."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {budgetBoard.map((budget) => (
            <div key={budget.title} className="rounded-2xl border border-border/70 p-5">
              <p className="text-base font-semibold text-foreground">{budget.title}</p>
              <p className="text-sm text-muted-foreground">{budget.owner}</p>
              <div className="mt-3 flex items-center justify-between text-sm font-semibold text-foreground">
                <span>{budget.amount}</span>
                <Badge variant="outline">{budget.status}</Badge>
              </div>
              <textarea
                className="mt-4 w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                placeholder="Add budget comment or reasoning"
              />
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1">
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  Edit/Return
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Feedback center"
        description="Send contextual guidance to students or society members."
        actions={<Button variant="outline">Compose feedback</Button>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {feedbackThreads.map((thread) => (
            <div key={thread.id} className="rounded-2xl border border-border/70 p-4">
              <p className="text-sm font-semibold text-foreground">{thread.topic}</p>
              <p className="text-xs text-muted-foreground">{thread.id} • {thread.recipient}</p>
              <Badge className="mt-3 w-fit" variant={thread.status === "Sent" ? "success" : "accent"}>
                {thread.status}
              </Badge>
            </div>
          ))}
        </div>
      </SectionCard>


      <SectionCard
        title="Account control"
        description="Close or unlock student accounts with confirmation documentation."
      >
        <div className="space-y-3">
          {accountClosures.map((account) => (
            <div key={account.id} className="flex flex-col gap-2 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{account.id}</p>
                <p className="text-xs text-muted-foreground">{account.reason}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Requested {account.requested}</span>
                <Button size="sm" variant="destructive">
                  Close account
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
