"use client";

import { useEffect, useMemo, useState } from "react";
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
  pending: { label: "Pending", variant: "accent" },
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

export default function AdminStudentAffairsPage() {
  const [receipts, setReceipts] = useState<StudentFeeReceipt[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | StudentFeeReceiptStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await studentAffairsAPI.getReceipts();
      setReceipts(res.receipts ?? []);
    } catch {
      setError("Failed to load student receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const pendingCount = useMemo(
    () => receipts.filter((receipt) => receipt.status === "pending").length,
    [receipts]
  );

  const filteredReceipts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const statusMatch = statusFilter === "all" || receipt.status === statusFilter;
      if (!statusMatch) return false;

      if (!normalized) return true;

      const text = [
        receipt.student?.name,
        receipt.student?.email,
        receipt.student?.studentId,
        receipt.payment.reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(normalized);
    });
  }, [receipts, statusFilter, searchTerm]);

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const response = await fetch(fileUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setActionError("Failed to download receipt. Please try again.");
    }
  };

  const syncReceipt = (updated: StudentFeeReceipt) => {
    setReceipts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDecision = async (id: string, decision: "accepted" | "rejected") => {
    const note = (noteById[id] ?? "").trim();
    if (decision === "rejected" && !note) {
      setActionError("Admin note is required before rejecting a receipt.");
      setActionMessage("");
      return;
    }

    setActionLoadingId(id);
    setActionError("");
    setActionMessage("");

    try {
      const res = await studentAffairsAPI.reviewReceipt(id, {
        decision,
        adminNote: note || undefined,
      });
      syncReceipt(res.receipt);
      setActionMessage(decision === "accepted" ? "Receipt accepted." : "Receipt rejected.");
      if (decision === "accepted") {
        setNoteById((prev) => ({ ...prev, [id]: "" }));
      }
    } catch {
      setActionError("Failed to update receipt status. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <SectionCard
        title="Student Affairs"
        description={`Review forwarded student bank receipts. Pending reviews: ${pendingCount}`}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="md:col-span-3 flex flex-col gap-2 text-sm text-muted-foreground">
            Search
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              placeholder="Search by student name, email, ID, or reference"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading receipt queue...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts submitted yet.</p>
        ) : filteredReceipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts match the selected filter/search.</p>
        ) : (
          <div className="space-y-4">
            {filteredReceipts.map((receipt) => {
              const statusMeta = STATUS_META[receipt.status] ?? STATUS_META.pending;
              const canReview = receipt.status === "pending";

              return (
                <div key={receipt.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {receipt.student?.name ?? "Student"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {receipt.student?.email ?? "No email"}
                        {receipt.student?.studentId ? ` · ID: ${receipt.student.studentId}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ref: {receipt.payment.reference} · Amount: ৳{receipt.payment.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paid on {formatDate(receipt.payment.paymentDate)} · Submitted {formatDate(receipt.createdAt)}
                      </p>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>

                  {receipt.payment.notes && (
                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground">
                      <p className="font-semibold">Student note</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.payment.notes}</p>
                    </div>
                  )}

                  {receipt.adminNote && (
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Admin note</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.adminNote}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={receipt.fileUrl} target="_blank" rel="noreferrer">
                        View receipt
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(receipt.fileUrl, receipt.fileName)}
                    >
                      Download
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <textarea
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                      placeholder="Add reason when rejecting"
                      value={noteById[receipt.id] ?? ""}
                      onChange={(e) => setNoteById((prev) => ({ ...prev, [receipt.id]: e.target.value }))}
                      disabled={!canReview || actionLoadingId === receipt.id}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        size="sm"
                        disabled={!canReview || actionLoadingId === receipt.id}
                        onClick={() => handleDecision(receipt.id, "accepted")}
                      >
                        {actionLoadingId === receipt.id ? "Processing..." : "Accept"}
                      </Button>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        disabled={!canReview || actionLoadingId === receipt.id}
                        onClick={() => handleDecision(receipt.id, "rejected")}
                      >
                        {actionLoadingId === receipt.id ? "Processing..." : "Reject"}
                      </Button>
                    </div>
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
