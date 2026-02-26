import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const vouchers = [
  {
    id: "VCH-114",
    expense: "Venue deposit",
    amount: "৳5,000",
    status: "Submitted",
  },
  {
    id: "VCH-109",
    expense: "Catering",
    amount: "৳3,450",
    status: "Draft",
  },
  {
    id: "VCH-107",
    expense: "Marketing",
    amount: "৳1,200",
    status: "Approved",
  },
];

export default function VouchersPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Vouchers & proof of expenses"
        description="Create, edit, and delete vouchers; attach supporting receipts."
        actions={[{ label: "Create voucher", href: "#" }]}
      />

      <SectionCard title="Ledger" description="Admin review status mirrors here for transparency.">
        <div className="space-y-4">
          {vouchers.map((voucher) => (
            <div key={voucher.id} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{voucher.expense}</p>
                  <p className="text-sm text-muted-foreground">{voucher.id}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{voucher.amount}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {voucher.status}
                </span>
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
                <Button size="sm" variant="destructive">
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
