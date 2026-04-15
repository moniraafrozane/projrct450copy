"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  studentAffairsAPI,
  type StudentFeeReceipt,
  type StudentFeeReceiptStatus,
} from "@/lib/api";

const STATUS_META: Record<
  StudentFeeReceiptStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  pending: { label: "Pending review", variant: "accent" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "warning" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudentBankReceiptPage() {
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [receipts, setReceipts] = useState<StudentFeeReceipt[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMyReceipts = async () => {
    try {
      setLoadingHistory(true);
      const res = await studentAffairsAPI.getMyReceipts();
      setReceipts(res.receipts ?? []);
    } catch {
      setError("Failed to load your receipt history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadMyReceipts();
  }, []);

  const resetForm = () => {
    setReference("");
    setPaymentDate("");
    setAmount("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!reference.trim() || !paymentDate || !amount || !file) {
      setError("Please fill all required fields and attach a receipt file.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    try {
      setSubmitting(true);
      const uploadRes = await studentAffairsAPI.uploadReceiptFile(file);

      await studentAffairsAPI.createReceipt({
        reference: reference.trim(),
        paymentDate,
        amount: numericAmount,
        fileUrl: uploadRes.fileUrl,
        fileName: uploadRes.fileName,
        mimeType: uploadRes.mimeType,
      });

      setMessage("Receipt submitted. Student Affairs will review it shortly.");
      resetForm();
      await loadMyReceipts();
    } catch {
      setError("Failed to submit receipt. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Upload bank receipt"
        description="Attach proof of payment for society fees. Student Affairs reviews and approves these receipts."
      />

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard title="Upload" description="Accepted formats: PDF, JPG, PNG (max 10 MB).">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-6">
            <label className="block text-sm font-medium text-foreground">Receipt file *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
            >
              Choose file 
            </button>
            {file ? (
              <p className="mt-2 text-xs text-muted-foreground">Selected: {file.name}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No file selected</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Receipt reference *
              <input
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
                placeholder="BANK-REF-2026"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Payment date *
              <input
                type="date"
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Amount *
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
                placeholder="150"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit for review"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
              Reset
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Submission history" description="Track Student Affairs review decisions.">
        {loadingHistory ? (
          <p className="text-sm text-muted-foreground">Loading history...</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => {
              const status = STATUS_META[receipt.status] ?? STATUS_META.pending;

              return (
                <div key={receipt.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{receipt.payment.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid on {formatDate(receipt.payment.paymentDate)} · Amount: ৳
                        {receipt.payment.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Submitted: {formatDate(receipt.createdAt)}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>

                  {receipt.adminNote && (
                    <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Admin note</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.adminNote}</p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={receipt.fileUrl} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
