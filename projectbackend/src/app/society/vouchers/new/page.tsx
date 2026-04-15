"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BudgetBreakdownContent,
  Event,
  SocietyApplication,
  applicationAPI,
  eventAPI,
  voucherAPI,
} from "@/lib/api";

type ReceiptMeta = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
};

export default function NewVoucherPage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [budgets, setBudgets] = useState<SocietyApplication[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [eventId, setEventId] = useState("");
  const [budgetApplicationId, setBudgetApplicationId] = useState("");
  const [receiptMeta, setReceiptMeta] = useState<ReceiptMeta | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await eventAPI.getManageableEvents();
        const upcomingEvents = (response.events || []).filter((event) => event.status === "upcoming");
        setEvents(upcomingEvents);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load events");
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        setLoadingBudgets(true);
        const response = await applicationAPI.getBudgetBreakdowns();
        setBudgets(response.applications || []);
      } catch {
        setBudgets([]);
      } finally {
        setLoadingBudgets(false);
      }
    };

    loadBudgets();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) || null,
    [events, eventId]
  );

  const eligibleBudgets = useMemo(() => {
    if (!eventId) return [];

    return budgets.filter((budget) => {
      const content = (budget.content || {}) as Partial<BudgetBreakdownContent>;
      return content.eventId === eventId;
    });
  }, [budgets, eventId]);

  useEffect(() => {
    if (!budgetApplicationId) {
      return;
    }

    const isStillValid = eligibleBudgets.some((budget) => budget.id === budgetApplicationId);
    if (!isStillValid) {
      setBudgetApplicationId("");
    }
  }, [eligibleBudgets, budgetApplicationId]);

  const handleReceiptFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    try {
      setUploadingReceipt(true);
      const response = await voucherAPI.uploadReceiptFile(file);
      setReceiptMeta({
        fileUrl: response.fileUrl,
        fileName: response.fileName,
        mimeType: response.mimeType,
      });
    } catch (uploadError: any) {
      setReceiptMeta(null);
      setError(uploadError.response?.data?.message || "Failed to upload receipt");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveDraft = async () => {
    setError("");
    setMessage("");

    const normalizedTitle = title.trim();
    const numericAmount = Number(amount);

    if (!normalizedTitle) {
      setError("Voucher title is required");
      return;
    }

    if (!eventId) {
      setError("Please select an event");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    if (!receiptMeta) {
      setError("Please upload a receipt file");
      return;
    }

    try {
      setSaving(true);

      const response = await voucherAPI.createVoucher({
        title: normalizedTitle,
        description: description.trim(),
        amount: numericAmount,
        eventId,
        budgetApplicationId: budgetApplicationId || undefined,
        receiptFileUrl: receiptMeta.fileUrl,
        receiptFileName: receiptMeta.fileName,
        receiptMimeType: receiptMeta.mimeType,
      });

      setMessage(response.message || "Draft saved successfully");

      setTimeout(() => {
        router.push("/society/vouchers?saved=1");
      }, 1200);
    } catch (saveError: any) {
      const backendMessage = saveError.response?.data?.message;
      const backendDetail = saveError.response?.data?.error;
      setError(backendDetail ? `${backendMessage || "Failed to create voucher"}: ${backendDetail}` : backendMessage || "Failed to create voucher");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Voucher workspace"
        title="Create voucher"
        description="Attach receipt and save the voucher as a draft for later review."
        actions={[{ label: "Back to vouchers", href: "/society/vouchers", variant: "outline" }]}
      />

      <SectionCard title="Voucher details" description="Fill in expense details and upload the proof document.">
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
            Voucher title *
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Venue deposit"
              disabled={saving}
            />
            <span className="text-xs text-muted-foreground">
              Examples: Venue deposit, Catering payment, Sound system rent, Banner printing, Decoration cost
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Description
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for this expense"
              rows={4}
              disabled={saving}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Amount (BDT) *
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                disabled={saving}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Event *
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={loadingEvents || saving}
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
            <p className="text-sm text-muted-foreground">
              Selected event: {selectedEvent.title} | {new Date(selectedEvent.eventDate).toLocaleDateString("en-GB")} | {selectedEvent.venue}
            </p>
          )}

          <label className="flex flex-col gap-2 text-sm">
            Linked budget (optional)
            <select
              value={budgetApplicationId}
              onChange={(e) => setBudgetApplicationId(e.target.value)}
              disabled={!eventId || loadingBudgets || saving}
              className="flex h-10 w-full rounded-2xl border border-border/70 bg-background px-4 py-2 text-sm"
            >
              <option value="">No linked budget</option>
              {eligibleBudgets.map((budget) => {
                const content = (budget.content || {}) as Partial<BudgetBreakdownContent>;
                const amountLabel = Number(content.totalAmount || 0).toLocaleString();
                return (
                  <option key={budget.id} value={budget.id}>
                    {budget.subject} | BDT {amountLabel}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Receipt file (PDF/JPG/PNG) *
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              onChange={(e) => handleReceiptFile(e.target.files?.[0])}
              disabled={uploadingReceipt || saving}
            />
          </label>

          {uploadingReceipt && <p className="text-sm text-muted-foreground">Uploading receipt...</p>}
          {receiptMeta && (
            <p className="text-sm text-green-700">
              Uploaded: {receiptMeta.fileName}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={handleSaveDraft}
            disabled={saving || uploadingReceipt || loadingEvents}
          >
            {saving ? "Saving..." : "Save draft"}
          </Button>
          <Button variant="outline" asChild>
            <a href="/society/vouchers">Cancel</a>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
