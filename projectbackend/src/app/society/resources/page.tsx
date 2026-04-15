import { PageHeader } from "@/components/patterns/page-header";

export default function SocietyResourcesPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Resources library"
        description="Centralized documents, policy links, and media assets with permissions."
        actions={[{ label: "Upload", href: "#" }]}
      />
    </div>
  );
}

