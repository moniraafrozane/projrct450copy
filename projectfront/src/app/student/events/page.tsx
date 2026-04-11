"use client";

import { SectionCard } from "@/components/patterns/section-card";

export default function StudentEventsPage() {
  return (
    <div className="space-y-10">
      <SectionCard
        title="Events"
        description="Categories and Event marketplace were removed from this page."
      >
        <p className="text-sm text-muted-foreground">Use the student dashboard to browse and filter events.</p>
      </SectionCard>
    </div>
  );
}
