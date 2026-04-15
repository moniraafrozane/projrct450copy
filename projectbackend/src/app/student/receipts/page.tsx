import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const receipts = [
  {
    type: "Event payment",
    event: "FinTech Futures Summit",
    amount: "৳25",
    date: "Jan 03, 10:27 AM",
    download: "PDF",
  },
  {
    type: "Certificate",
    event: "Cultural Night",
    amount: "--",
    date: "Dec 18, 04:02 PM",
    download: "PDF",
  },
  {
    type: "Donation",
    event: "Sustainability Hackathon",
    amount: "৳15",
    date: "Nov 21, 08:18 PM",
    download: "PDF",
  },
];

export default function StudentReceiptsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Receipts & certificates"
        description="Access payment confirmations, admin approvals, and downloadable certificates."
        actions={[{ label: "Download all", href: "#", variant: "outline" }]}
      />

      <SectionCard
        title="Archive"
        description="Every registration and completion generates a receipt with a secure timestamp."
      >
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <div key={receipt.event} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">{receipt.event}</p>
                <p className="text-sm text-muted-foreground">
                  {receipt.type} • {receipt.date}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline">{receipt.amount}</Badge>
                <Button variant="secondary">{receipt.download}</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
