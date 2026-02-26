import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

export default function StudentBankReceiptPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Upload bank receipt"
        description="Attach proof of payment for society fees. Admins receive a timestamped notification instantly."
      />

      <SectionCard title="Upload" description="Accepted formats: PDF, JPG, PNG (max 10 MB).">
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">Drag & drop or select file</p>
          <Button className="mt-4">Choose file</Button>
        </div>
        <form className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Receipt reference
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              placeholder="BANK-REF-2025"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Payment date
            <input
              type="date"
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Amount
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              placeholder="৳150"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Notes
            <textarea
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              rows={3}
              placeholder="Optional context for admins"
            />
          </label>
        </form>
        <div className="flex items-center gap-3">
          <Button>Submit for review</Button>
          <Button variant="outline">Reset</Button>
        </div>
      </SectionCard>
    </div>
  );
}
