import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const records = [
  {
    eventName: "cse carnival",
    type: "Expense",
    amount: "৳4,820",
    organizer: "CSE Society",
    date: "Jan 02, 14:00",
  },
  {
    eventName: " Inter University Hackathon",
    type: "Income",
    amount: "৳12,500",
     organizer: "CSE Society",
    date: "Jan 02, 10:33",
  },
  {
    eventName: "Cricket Tournament",
    type: "Expense",
    amount: "৳1,120",
    organizer: "CSE Society",
    date: "Jan 01, 19:21",
  },
];

export default function FinancialRecordsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Financial records"
        description="Search, edit, and delete transactions with strict audit trail enforcement."
        actions={[{ label: "Add record", href: "#" }]}
      />

      <SectionCard title="Ledger" description="Inline search with Event name and Type">
        <div className="flex flex-wrap gap-4">
          <input
            placeholder="Search by Event name,Type"
            className="flex-1 min-w-[220px] rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
          />
          <Button variant="outline">Advanced filters</Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Event Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Organizer</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.eventName} className="border-t border-border/50">
                  <td className="px-6 py-4 font-semibold text-foreground">{record.eventName}</td>
                  <td className="px-6 py-4">{record.type}</td>
                  <td className="px-6 py-4">{record.amount}</td>
                  <td className="px-6 py-4">{record.organizer}</td>
                  <td className="px-6 py-4 text-muted-foreground">{record.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary">
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive">
                        Delete
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
