import { Button } from "@/components/ui/button";

export default function AdminPasswordResetPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-border/70 bg-card/80 p-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">First login policy</p>
        <h1 className="text-3xl font-semibold text-foreground">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Admins must update passwords the first time they access the console.
        </p>
      </div>
      <form className="space-y-4">
        <label className="flex flex-col gap-2 text-sm">
          Temporary password
          <input
            type="password"
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          New password
          <input
            type="password"
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Confirm password
          <input
            type="password"
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base"
          />
        </label>
        <Button className="w-full" type="submit">
          Update password
        </Button>
      </form>
    </div>
  );
}
