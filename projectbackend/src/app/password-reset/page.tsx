import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

export default function PasswordResetPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Self-service recovery"
        title="Forgot password"
        description="Students, admins, and society members can recover access from this single workflow."
        actions={[{ label: "Back to login", href: "/login", variant: "outline" }]}
      />

      <SectionCard
        title="Verify identity"
        description="Tell us who you are and where to send the reset instructions."
      >
        <form className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Role
            <select className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground">
              <option>Student</option>
              <option>Admin</option>
              <option>Society member</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Registration number or email
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
              placeholder="e.g., 2020331081 or moniraafrozane@gmail.com"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Preferred delivery
            <select className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground">
              <option>Email</option>
              <option>SMS</option>
              <option>Phone call</option>
            </select>
          </label>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Send reset link</Button>
          <Button variant="outline">Need help?</Button>
        </div>
      </SectionCard>
    </div>
  );
}
