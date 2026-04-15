"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applicationAPI,
  BudgetBreakdownContent,
  BudgetBreakdownSection,
  Event,
  eventAPI,
  SocietyApplication,
} from "@/lib/api";

const costSections = [
  { key: "venue", title: "Venue-related costs", helper: "Hall rental, stage setup, permits" },
  { key: "technical", title: "Event setup & technical costs", helper: "Lighting, sound, livestream, equipment" },
  { key: "catering", title: "Food & catering costs", helper: "Snacks, meals, beverages" },
  { key: "manpower", title: "Manpower costs", helper: "Volunteers, security, support staff" },
  { key: "marketing", title: "Marketing costs", helper: "Posters, social, paid reach" },
  { key: "documentation", title: "Documentation costs", helper: "Photography, video, post-production" },
  { key: "accessories", title: "Accessories", helper: "Badges, banners, stationeries, contingencies" },
];

type EditableSection = BudgetBreakdownSection;

const createInitialSections = (): EditableSection[] =>
  costSections.map((section) => ({
    key: section.key,
    title: section.title,
    helper: section.helper,
    amount: 0,
    notes: "",
    optional: false,
  }));

export default function NewBudgetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [existingBudget, setExistingBudget] = useState<SocietyApplication | null>(null);

  const [eventId, setEventId] = useState("");
  const [sections, setSections] = useState<EditableSection[]>(createInitialSections());

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await eventAPI.getManageableEvents();
        const upcoming = (response.events || []).filter((event) => event.status === "upcoming");
        setEvents(upcoming);
        setError("");
      } catch (loadError: any) {
        try {
          // Fallback to public listing so budget creation is not blocked by protected endpoint issues.
          const fallbackResponse = await eventAPI.getAllEvents({ status: "upcoming", upcoming: true, limit: 200 });
          const upcoming = (fallbackResponse.events || []).filter((event) => event.status === "upcoming");
          setEvents(upcoming);
          setError("");
        } catch (fallbackError: any) {
          setError(
            fallbackError.response?.data?.message ||
              loadError.response?.data?.message ||
              "Failed to load upcoming events"
          );
        }
      } finally {
        setLoadingEvents(false);
      }
    };

    loadUpcomingEvents();
  }, []);

  useEffect(() => {
    const loadForEdit = async () => {
      if (!editId) {
        setExistingBudget(null);
        return;
      }

      try {
        setLoadingExisting(true);
        setError("");
        const response = await applicationAPI.getApplicationById(editId);
        const application = response.application;

        if (application.type !== "budget_breakdown") {
          setError("Selected record is not a budget breakdown");
          return;
        }

        setExistingBudget(application);

        const content = (application.content || {}) as Partial<BudgetBreakdownContent>;
        setEventId(content.eventId || "");

        const incomingSections = Array.isArray(content.sections) ? content.sections : [];
        const mergedSections = costSections.map((base) => {
          const found = incomingSections.find(
            (section) => section.key === base.key || section.title === base.title
          );
          return {
            key: base.key,
            title: base.title,
            helper: base.helper,
            amount: Number(found?.amount || 0),
            notes: found?.notes || "",
            optional: Boolean(found?.optional),
          };
        });

        setSections(mergedSections);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load budget for editing");
      } finally {
        setLoadingExisting(false);
      }
    };

    loadForEdit();
  }, [editId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) || null,
    [events, eventId]
  );

  const calculatedTotal = useMemo(
    () => sections.reduce((total, section) => total + (Number(section.amount) || 0), 0),
    [sections]
  );

  const totalAmount = calculatedTotal;

  const updateSection = (key: string, field: keyof EditableSection, value: string | boolean) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.key !== key) return section;
        if (field === "amount") {
          const amount = Number(value);
          return { ...section, amount: Number.isFinite(amount) && amount >= 0 ? amount : 0 };
        }
        return { ...section, [field]: value };
      })
    );
    setMessage("");
    setError("");
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    if (!eventId) {
      setError("Please select an upcoming event");
      return;
    }

    const hasPositive = sections.some((section) => Number(section.amount) > 0);
    if (!hasPositive) {
      setError("Enter an amount greater than 0 for at least one section");
      return;
    }

    try {
      setSaving(true);

      if (isEditMode && editId) {
        const subjectEvent = selectedEvent?.title || (existingBudget?.content as any)?.eventTitle || "Untitled Event";
        const fallbackContent = (existingBudget?.content || {}) as Partial<BudgetBreakdownContent>;

        const response = await applicationAPI.updateApplication(editId, {
          type: "budget_breakdown",
          subject: `Budget breakdown - ${subjectEvent}`,
          content: {
            eventId,
            eventTitle: selectedEvent?.title || fallbackContent.eventTitle || "Untitled Event",
            eventDate: selectedEvent?.eventDate || fallbackContent.eventDate || "",
            eventStartTime: selectedEvent?.startTime || fallbackContent.eventStartTime || "",
            eventVenue: selectedEvent?.venue || fallbackContent.eventVenue || "",
            organizerName: selectedEvent?.organizerName || fallbackContent.organizerName || "",
            sections,
            calculatedTotal,
            overrideAmount: null,
            totalAmount,
          },
        });

        setMessage(response.message || "budget has been edited");
      } else {
        await applicationAPI.createBudgetBreakdown({
          eventId,
          sections,
          calculatedTotal,
          overrideAmount: null,
          totalAmount,
        });

        setMessage("budget created successfully");
      }

      setTimeout(() => {
        router.push(isEditMode ? "/society/budgets?edited=1" : "/society/budgets");
      }, 1200);
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || "Failed to save budget breakdown");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Budget workspace"
        title={isEditMode ? "Edit budget breakdown" : "Create budget breakdown"}
        description={
          isEditMode
            ? "Update an existing budget before admin review."
            : "Capture projected spend per category before sending to admin review."
        }
        actions={[{ label: "Back to budgets", href: "/society/budgets", variant: "outline" }]}
      />

      <SectionCard
        title="Budget setup"
        description="Select an upcoming event and provide a detailed budget split."
      >
        {loadingExisting && (
          <div className="mb-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Loading budget data...
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          <label className="flex flex-col gap-2 text-sm">
            Upcoming event *
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEvents || loadingExisting || saving}
              className="flex h-10 w-full rounded-2xl border border-border/70 bg-background px-4 py-2 text-sm"
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedEvent && (
          <p className="mt-3 text-sm text-muted-foreground">
            Selected event: {selectedEvent.title} | {new Date(selectedEvent.eventDate).toLocaleDateString("en-GB")} | {selectedEvent.venue}
          </p>
        )}
      </SectionCard>

      <SectionCard title="Budget categories" description="Enter projected amount and notes for each section.">
        <div className="grid gap-5">
          {sections.map((section) => (
            <div key={section.key} className="space-y-4 rounded-2xl border border-border/70 p-5">
              <div>
                <p className="text-base font-semibold text-foreground">{section.title}</p>
                <p className="text-sm text-muted-foreground">{section.helper}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Estimated amount (BDT)
                  <Input
                    type="number"
                    min={0}
                    value={section.amount || ""}
                    onChange={(e) => updateSection(section.key, "amount", e.target.value)}
                    placeholder="e.g. 6500"
                    disabled={saving || loadingExisting}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Notes / justification
                  <Textarea
                    value={section.notes}
                    onChange={(e) => updateSection(section.key, "notes", e.target.value)}
                    placeholder="Explain the spend"
                    rows={3}
                    disabled={saving || loadingExisting}
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={section.optional}
                  onChange={(e) => updateSection(section.key, "optional", e.target.checked)}
                  disabled={saving || loadingExisting}
                />
                Mark as optional
              </label>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Total budget" description="Review totals before creating the draft.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Calculated total (BDT)
            <Input value={String(calculatedTotal)} readOnly />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Final total to save (BDT)
            <Input value={String(totalAmount)} readOnly />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || loadingEvents || loadingExisting}
          >
            {saving ? "Saving..." : isEditMode ? "Update budget" : "Save budget draft"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/society/budgets")}
            disabled={saving || loadingExisting}
          >
            Cancel
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
