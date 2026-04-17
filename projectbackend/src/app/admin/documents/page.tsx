import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const documents = [
  {
    title: "Sponsorship MoU",
    owner: "Finance Society",
    status: "Awaiting approval",
    updated: "Jan 03, 07:42",
  },
  {
    title: "Health Week vendor contract",
    owner: "Student Affairs",
    status: "Approved",
    updated: "Jan 02, 18:12",
  },
  {
    title: "Innovation Week insurance",
    owner: "Entrepreneurship Hub",
    status: "Returned",
    updated: "Jan 02, 12:20",
  },
];

export default function AdminDocumentsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Document vault"
        description="Upload, store, and manage documents with approval status indicators."
        actions={[{ label: "Upload", href: "#" }]}
      />

      <SectionCard title="Recent uploads" description="Every document inherits SOC audit metadata.">
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.title} className="rounded-2xl border border-border/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{doc.title}</p>
                  <p className="text-sm text-muted-foreground">{doc.owner}</p>
                </div>
                <Badge variant={doc.status === "Approved" ? "success" : doc.status === "Returned" ? "warning" : "accent"}>
                  {doc.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Updated {doc.updated}</span>
                <Button size="sm" variant="outline">
                  View details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
