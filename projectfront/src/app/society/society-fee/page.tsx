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

function buildSessionOptions() {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let startYear = currentYear + 1; startYear >= currentYear - 7; startYear -= 1) {
    options.push(`${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`);
  }
  return options;
}

const SESSION_OPTIONS = buildSessionOptions();

const RECEIPTS_PAGE_SIZE = 10;

export default function SocietyFeePage() {
  const [receipts, setReceipts] = useState<StudentFeeReceipt[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | StudentFeeReceiptStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: RECEIPTS_PAGE_SIZE, total: 0, totalPages: 1 });
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

  const loadReceipts = async (
    pageOverride?: number,
    filterOverrides?: { session?: string; semester?: string; registration?: string; search?: string }
  ) => {
    const pageToUse = pageOverride ?? page;
    const sessionToUse = filterOverrides?.session ?? sessionFilter;
    const semesterToUse = filterOverrides?.semester ?? semesterFilter;
    const registrationToUse = filterOverrides?.registration ?? registrationFilter;
    const searchToUse = filterOverrides?.search ?? debouncedSearch;
    try {
      setLoading(true);
      setError("");
      const res = await studentAffairsAPI.getReceipts({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchToUse || undefined,
        session: sessionToUse || undefined,
        semester: semesterToUse.trim() || undefined,
        registration: registrationToUse.trim() || undefined,
        page: pageToUse,
        limit: RECEIPTS_PAGE_SIZE,
      });
      setReceipts(res.receipts ?? []);
      if (res.pagination) setPagination(res.pagination);
      setPage(pageToUse);
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

  const handleApplySessionFilters = () => loadReceipts(1);

  const handleResetSessionFilters = () => {
    setSessionFilter("");
    setSemesterFilter("");
    setRegistrationFilter("");
    setSearchTerm("");
    setDebouncedSearch("");
    loadReceipts(1, { session: "", semester: "", registration: "", search: "" });
  };

  const hasSessionFilters = Boolean(
    sessionFilter || semesterFilter.trim() || registrationFilter.trim() || searchTerm.trim()
  );

  const hasNoData = !loading && !error && pagination.total === 0;
  const isFiltered = statusFilter !== "all" || Boolean(debouncedSearch) || hasSessionFilters;

  const syncReceipt = (updated: StudentFeeReceipt) => {
    setReceipts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDecision = async (id: string, decision: "accepted" | "rejected") => {
    const note = (noteById[id] ?? "").trim();
    if (decision === "rejected" && !note) {
      setActionError("Note is required before rejecting a receipt.");
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
      setActionMessage(decision === "accepted" ? "Receipt approved." : "Receipt rejected.");
      loadReceipts();
    } catch {
      setActionError("Failed to update receipt status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleForwardToAdmin = async (id: string) => {
    const note = (noteById[id] ?? "").trim();
    if (!note) {
      setActionError("Note is required before forwarding to admin.");
      setActionMessage("");
      return;
    }

    setActionLoadingId(id);
    setActionError("");
    setActionMessage("");

    try {
      const res = await studentAffairsAPI.forwardReceiptToAdmin(id, { note });
      syncReceipt(res.receipt);
      setActionMessage("Receipt forwarded to admin.");
      loadReceipts();
    } catch {
      setActionError("Failed to forward receipt to admin.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button asChild>
          <a href="/society/fee-report">Open Fee Report</a>
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
        title="Society fee receipts"
        description="View receipts submitted by students from the bank receipt page."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-muted-foreground">
            Search
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              placeholder="Search by student name or email"
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

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-muted-foreground">
            Session
            <select
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            >
              <option value="">All sessions</option>
              {SESSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-muted-foreground">
            Registration Number
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              placeholder="e.g. 2024331063 or 24 for 2024 "
              value={registrationFilter}
              onChange={(e) => setRegistrationFilter(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-muted-foreground">
            Semester
            <input
              className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
              placeholder="e.g. 1st, 1/1 2nd, 2/2"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
            />
          </label>

          <div className="flex items-end gap-2">
            <Button onClick={handleApplySessionFilters}>Apply</Button>
            <Button variant="outline" onClick={handleResetSessionFilters} disabled={!hasSessionFilters}>
              Reset
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading student receipts...</p>
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
              const canApprove = receipt.status === "pending";
              const canForward = receipt.status === "pending" && receipt.reviewedBy;

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
                        Semester: {receipt.payment.semester || "N/A"} · Session: {receipt.payment.session || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paid on {formatDate(receipt.payment.paymentDate)}
                        {receipt.isManualEntry
                          ? " · Recorded by admin"
                          : ` · Submitted ${formatDate(receipt.createdAt)}`}
                      </p>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>

                  {receipt.isManualEntry && (
                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      Marked paid directly by an admin — no receipt was uploaded for this payment.
                    </div>
                  )}

                  {receipt.forwardedToAdmin && receipt.adminNote && (
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Forwarded note</p>
                      <p className="mt-1 whitespace-pre-wrap">{receipt.adminNote}</p>
                    </div>
                  )}

                  {!receipt.isManualEntry && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={receipt.fileUrl} target="_blank" rel="noreferrer">
                          View receipt
                        </a>
                      </Button>
                    </div>
                  )}

                  {canApprove && !receipt.reviewedBy && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <textarea
                        className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                        placeholder="Add note (optional - only required to reject)"
                        value={noteById[receipt.id] ?? ""}
                        onChange={(e) => setNoteById((prev) => ({ ...prev, [receipt.id]: e.target.value }))}
                        disabled={actionLoadingId === receipt.id}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="flex-1"
                          size="sm"
                          disabled={actionLoadingId === receipt.id}
                          onClick={() => handleDecision(receipt.id, "accepted")}
                        >
                          {actionLoadingId === receipt.id ? "Processing..." : "Approve for forwarding"}
                        </Button>
                        <Button
                          className="flex-1"
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === receipt.id}
                          onClick={() => handleDecision(receipt.id, "rejected")}
                        >
                          {actionLoadingId === receipt.id ? "Processing..." : "Reject"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {canForward && receipt.reviewedBy && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 mb-4">
                      <p className="font-semibold">Approved by: {receipt.reviewedBy?.name || "Society member"}</p>
                    </div>
                  )}

                  {canForward && receipt.reviewedBy && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <textarea
                        className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                        placeholder="Add note for admin (required)"
                        value={noteById[receipt.id] ?? ""}
                        onChange={(e) => setNoteById((prev) => ({ ...prev, [receipt.id]: e.target.value }))}
                        disabled={actionLoadingId === receipt.id}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="flex-1"
                          size="sm"
                          variant="secondary"
                          disabled={actionLoadingId === receipt.id}
                          onClick={() => handleForwardToAdmin(receipt.id)}
                        >
                          {actionLoadingId === receipt.id ? "Processing..." : "Forward to admin"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {receipt.status === "rejected" && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <p>This receipt has been rejected. No further actions available.</p>
                    </div>
                  )}

                  {receipt.forwardedToAdmin && receipt.status === "pending" && (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      <p>Forwarded to admin on {receipt.forwardedAt ? formatDate(receipt.forwardedAt) : "unknown"}. Awaiting admin review.</p>
                    </div>
                  )}
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
