"use client";

import { useEffect, useState } from "react";
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

const RECEIPTS_PAGE_SIZE = 20;

export default function AdminStudentAffairsPage() {
  const [receipts, setReceipts] = useState<StudentFeeReceipt[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | StudentFeeReceiptStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: RECEIPTS_PAGE_SIZE, total: 0, totalPages: 1 });
  const [awaitingAdminAction, setAwaitingAdminAction] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  // Debounce free-text search so we're not firing a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await studentAffairsAPI.getReceipts({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
        page,
        limit: RECEIPTS_PAGE_SIZE,
      });
      setReceipts(res.receipts ?? []);
      setAwaitingAdminAction(res.awaitingAdminAction ?? 0);
      if (res.pagination) setPagination(res.pagination);
    } catch {
      setError("Failed to load student receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, page]);

  const hasNoData = !loading && !error && pagination.total === 0;
  const isFiltered = statusFilter !== "all" || Boolean(debouncedSearch);

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
      loadReceipts();
    } catch {
      setActionError("Failed to update receipt status. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button asChild>
          <a href="/admin/student-affairs/fee-report">Open Fee Report</a>
        </Button>
      </div>

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
        description={`Final approval of student receipts. Awaiting admin action: ${awaitingAdminAction}`}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-muted-foreground">
            Search
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-muted-foreground">
            Status
            <select
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | StudentFeeReceiptStatus)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading receipt queue...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : hasNoData ? (
          <p className="text-sm text-muted-foreground">
            {isFiltered ? "No receipts match the selected filter/search." : "No receipts submitted yet."}
          </p>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => {
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

                  {receipt.forwardedToAdmin && receipt.adminNote && (
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Society member's forwarding note</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.adminNote}</p>
                    </div>
                  )}

                  {!receipt.forwardedToAdmin && receipt.adminNote && (
                    <div className="mt-4 rounded-xl border border-red-300/60 bg-red-50/70 px-4 py-3 text-sm text-red-900">
                      <p className="font-semibold">Admin rejection reason</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.adminNote}</p>
                    </div>
                  )}

                  {receipt.forwardedToAdmin && (
                    <div className="mt-4 rounded-xl border border-sky-300/60 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
                      <p className="font-semibold">Forwarded to admin</p>
                      <p className="mt-1">
                        By {receipt.forwardedBy?.name ?? 'Society member'} on{' '}
                        {receipt.forwardedAt ? formatDate(receipt.forwardedAt) : 'Unknown'}
                      </p>
                    </div>
                  )}

                  {canReview && (
                    <div className="mt-4 rounded-xl border border-orange-300/60 bg-orange-50/70 px-4 py-3 text-sm text-orange-900">
                      <p className="font-semibold">⚠️ Awaiting your action</p>
                      <p className="mt-1">This receipt is ready for final approval. Accept to mark as complete.</p>
                    </div>
                  )}

                  {receipt.status === "accepted" && (
                    <div className="mt-4 rounded-xl border border-green-300/60 bg-green-50/70 px-4 py-3 text-sm text-green-900">
                      <p className="font-semibold">✓ Accepted by admin</p>
                      <p className="mt-1">
                        Approved on {receipt.reviewedAt ? formatDate(receipt.reviewedAt) : 'unknown'}
                      </p>
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

        {!loading && !error && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} receipts total
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
