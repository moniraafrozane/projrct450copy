import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";

const profile = {
  registration: "2020331081",
  name: "Ane",
  email: "moniraafrozane@gmail.com",
  phone: "+1 202 555 0182",
};

const preferences = [
  { title: "Notifications", description: "Email + mobile push", status: "Enabled" },
  { title: "Calendar sync", description: "Linked to Outlook", status: "Enabled" },
  { title: "Two-factor", description: "SMS backup codes", status: "Pending" },
];

export default function StudentProfilePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Profile & security"
        description="Update contact information, manage preferences, and trigger password resets."
      />

      <SectionCard title="Personal details" description="Changes cascade across society and admin modules.">
        <dl className="grid gap-6 md:grid-cols-2">
          {Object.entries(profile).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-border/70 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {key}
              </dt>
              <dd className="text-base font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <Button className="mt-4 w-fit">Edit profile</Button>
      </SectionCard>

      <SectionCard title="Preferences" description="Customize how you receive event updates and admin feedback.">
        <div className="grid gap-4">
          {preferences.map((pref) => (
            <div
              key={pref.title}
              className="flex flex-col gap-2 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">{pref.title}</p>
                <p className="text-sm text-muted-foreground">{pref.description}</p>
              </div>
              <Button variant={pref.status === "Enabled" ? "secondary" : "outline"}>
                {pref.status === "Enabled" ? "Update" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
