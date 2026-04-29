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
  Event,
  eventAPI,
  SocietyApplication,
} from "@/lib/api";

interface BudgetCategory {
  id: string;
  title: string;
  amount: number;
  isEditing: boolean;
}

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
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryAmount, setNewCategoryAmount] = useState("");
  const [addCategoryError, setAddCategoryError] = useState("");

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
        const loadedCategories: BudgetCategory[] = incomingSections.map((section, index) => ({
          id: `cat-${Date.now()}-${index}`,
          title: section.title || "",
          amount: Number(section.amount || 0),
          isEditing: false,
        }));

        setCategories(loadedCategories);
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
    () => categories.reduce((total, category) => total + (Number(category.amount) || 0), 0),
    [categories]
  );

  const totalAmount = calculatedTotal;

  // Category management functions
  const isDuplicateTitle = (title: string, excludeId?: string): boolean => {
    return categories.some((cat) => 
      cat.title.toLowerCase() === title.toLowerCase() && cat.id !== excludeId
    );
  };

  const addCategory = () => {
    setAddCategoryError("");

    if (!newCategoryTitle.trim()) {
      setAddCategoryError("Category title is required");
      return;
    }

    if (isDuplicateTitle(newCategoryTitle)) {
      setAddCategoryError(`Category "${newCategoryTitle}" already exists`);
      return;
    }

    const amount = Number(newCategoryAmount) || 0;
    if (amount < 0) {
      setAddCategoryError("Amount cannot be negative");
      return;
    }

    const newCategory: BudgetCategory = {
      id: `cat-${Date.now()}`,
      title: newCategoryTitle.trim(),
      amount,
      isEditing: false,
    };

    setCategories([...categories, newCategory]);
    setNewCategoryTitle("");
    setNewCategoryAmount("");
    setError("");
    setMessage("");
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((cat) => cat.id !== id));
    setError("");
    setMessage("");
  };

  const toggleEditMode = (id: string) => {
    setCategories(
      categories.map((cat) =>
        cat.id === id ? { ...cat, isEditing: !cat.isEditing } : cat
      )
    );
  };

  const updateCategory = (id: string, field: "title" | "amount", value: string) => {
    if (field === "title") {
      const trimmedValue = value.trim();
      if (trimmedValue && isDuplicateTitle(trimmedValue, id)) {
        return; // Don't update if it would create a duplicate
      }
      setCategories(
        categories.map((cat) =>
          cat.id === id ? { ...cat, title: trimmedValue } : cat
        )
      );
    } else if (field === "amount") {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount >= 0) {
        setCategories(
          categories.map((cat) =>
            cat.id === id ? { ...cat, amount } : cat
          )
        );
      }
    }
    setError("");
    setMessage("");
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    if (!eventId) {
      setError("Please select an upcoming event");
      return;
    }

    if (categories.length === 0) {
      setError("Add at least one budget category");
      return;
    }

    const hasPositive = categories.some((cat) => Number(cat.amount) > 0);
    if (!hasPositive) {
      setError("Enter an amount greater than 0 for at least one category");
      return;
    }

    try {
      setSaving(true);

      const sections = categories.map((cat) => ({
        title: cat.title,
        amount: cat.amount,
        key: `cat-${cat.id}`,
        helper: "",
        notes: "",
        optional: false,
      }));

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

      <SectionCard title="Budget categories" description="Add, edit, or delete budget categories as needed.">
        <div className="space-y-5">
          {/* List of categories */}
          {categories.length > 0 && (
            <div className="space-y-3 border-b border-border/50 pb-5">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-2">
                    {category.isEditing ? (
                      <input
                        type="text"
                        value={category.title}
                        onChange={(e) => updateCategory(category.id, "title", e.target.value)}
                        placeholder="Category title"
                        disabled={saving || loadingExisting}
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="text-sm font-medium text-foreground">{category.title}</p>
                    )}
                    {category.isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={category.amount || ""}
                        onChange={(e) => updateCategory(category.id, "amount", e.target.value)}
                        placeholder="0"
                        disabled={saving || loadingExisting}
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {new Intl.NumberFormat("en-BD", {
                          style: "currency",
                          currency: "BDT",
                          minimumFractionDigits: 0,
                        }).format(category.amount)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => toggleEditMode(category.id)}
                      disabled={saving || loadingExisting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      title={category.isEditing ? "Save changes" : "Edit category"}
                    >
                      {category.isEditing ? (
                        <>
                          <span>✓</span>
                          <span className="hidden sm:inline">Save</span>
                        </>
                      ) : (
                        <>
                          <span>✎</span>
                          <span className="hidden sm:inline">Edit</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => deleteCategory(category.id)}
                      disabled={saving || loadingExisting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      title="Delete category"
                    >
                      <span>🗑</span>
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new category */}
          <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Add New Category</p>
            {addCategoryError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {addCategoryError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3 sm:gap-2">
              <input
                type="text"
                value={newCategoryTitle}
                onChange={(e) => {
                  setNewCategoryTitle(e.target.value);
                  setAddCategoryError("");
                }}
                placeholder="Category title"
                disabled={saving || loadingExisting}
                className="rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={newCategoryAmount}
                onChange={(e) => {
                  setNewCategoryAmount(e.target.value);
                  setAddCategoryError("");
                }}
                placeholder="Amount (BDT)"
                disabled={saving || loadingExisting}
                className="rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              />
              <Button
                onClick={addCategory}
                disabled={saving || loadingExisting || !newCategoryTitle.trim()}
                className="w-full sm:w-auto"
              >
                + Add
              </Button>
            </div>
          </div>

          {categories.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/50 bg-muted/30 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No categories added yet. Add your first budget category above.
              </p>
            </div>
          )}
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
