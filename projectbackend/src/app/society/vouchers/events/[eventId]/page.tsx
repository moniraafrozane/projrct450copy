"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Voucher, VoucherStatus, eventAPI, voucherAPI } from "@/lib/api";

const statusLabel: Record<VoucherStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusBadgeClass: Record<VoucherStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-rose-100 text-rose-700",
};

type ReceiptMeta = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
};

type EditDraft = {
  title: string;
  amount: string;
  description: string;
  receiptMeta: ReceiptMeta | null;
};

type AddDraft = {
  title: string;
  amount: string;
  description: string;
  receiptMeta: ReceiptMeta | null;
};

export default function EventExpensePage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [eventTitle, setEventTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ title: "", amount: "", description: "", receiptMeta: null });
  const [editUploadingReceipt, setEditUploadingReceipt] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>({ title: "", amount: "", description: "", receiptMeta: null });
  const [addUploadingReceipt, setAddUploadingReceipt] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  // Per-row action state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const addTitleRef = useRef<HTMLInputElement>(null);

  // Load vouchers for this event
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await voucherAPI.getVouchers({ eventId });
        const list = response.vouchers || [];
        setVouchers(list);
        if (list.length > 0 && list[0].event?.title) {
          setEventTitle(list[0].event.title);
        } else {
          // No vouchers yet — fetch event name separately
          try {
            const evResp = await eventAPI.getEventById(eventId);
            setEventTitle(evResp.event?.title || "Event");
          } catch {
            setEventTitle("Event");
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load expenses");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  // Focus add form title when it appears
  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => addTitleRef.current?.focus(), 50);
    }
  }, [showAddForm]);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // ── Receipt upload helpers ──────────────────────────────────────────────────

  const handleEditReceiptUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      setEditUploadingReceipt(true);
      setError("");
      const res = await voucherAPI.uploadReceiptFile(file);
      setEditDraft((prev) => ({
        ...prev,
        receiptMeta: { fileUrl: res.fileUrl, fileName: res.fileName, mimeType: res.mimeType },
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload receipt");
    } finally {
      setEditUploadingReceipt(false);
    }
  };

  const handleAddReceiptUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      setAddUploadingReceipt(true);
      setError("");
      const res = await voucherAPI.uploadReceiptFile(file);
      setAddDraft((prev) => ({
        ...prev,
        receiptMeta: { fileUrl: res.fileUrl, fileName: res.fileName, mimeType: res.mimeType },
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload receipt");
    } finally {
      setAddUploadingReceipt(false);
    }
  };

  // ── Inline Edit ─────────────────────────────────────────────────────────────

  const startEdit = (voucher: Voucher) => {
    setEditingId(voucher.id);
    setEditDraft({
      title: voucher.title,
      amount: String(voucher.amount),
      description: voucher.description || "",
      receiptMeta: {
        fileUrl: voucher.receiptFileUrl,
        fileName: voucher.receiptFileName,
        mimeType: voucher.receiptMimeType,
      },
    });
    setShowAddForm(false);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ title: "", amount: "", description: "", receiptMeta: null });
  };

  const saveEdit = async (voucherId: string) => {
    const numericAmount = Number(editDraft.amount);
    if (!editDraft.title.trim()) { setError("Title is required"); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("Amount must be greater than 0"); return; }
    if (!editDraft.receiptMeta) { setError("Receipt is required"); return; }

    try {
      setSavingEdit(true);
      setError("");
      const res = await voucherAPI.updateVoucher(voucherId, {
        title: editDraft.title.trim(),
        description: editDraft.description.trim() || undefined,
        amount: numericAmount,
        receiptFileUrl: editDraft.receiptMeta.fileUrl,
        receiptFileName: editDraft.receiptMeta.fileName,
        receiptMimeType: editDraft.receiptMeta.mimeType,
      });
      setVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? res.voucher : v))
      );
      setEditingId(null);
      flash("Expense updated successfully");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update expense");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteVoucher = async (voucherId: string, title: string) => {
    if (!window.confirm(`Delete expense "${title}"? This cannot be undone.`)) return;
    try {
      setDeletingId(voucherId);
      setError("");
      await voucherAPI.deleteVoucher(voucherId);
      setVouchers((prev) => prev.filter((v) => v.id !== voucherId));
      flash("Expense deleted");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Forward to Admin ────────────────────────────────────────────────────────

  const forwardToAdmin = async (voucherId: string) => {
    try {
      setSubmittingId(voucherId);
      setError("");
      const res = await voucherAPI.submitVoucher(voucherId);
      setVouchers((prev) =>
        prev.map((v) =>
          v.id === voucherId ? { ...v, status: res.voucher?.status || "submitted" } : v
        )
      );
      flash(res.message || "Forwarded to admin");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to forward to admin");
    } finally {
      setSubmittingId(null);
    }
  };

  // ── Add Expense ─────────────────────────────────────────────────────────────

  const resetAddForm = () => {
    setAddDraft({ title: "", amount: "", description: "", receiptMeta: null });
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    resetAddForm();
  };

  const saveAdd = async () => {
    const numericAmount = Number(addDraft.amount);
    if (!addDraft.title.trim()) { setError("Title is required"); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("Amount must be greater than 0"); return; }
    if (!addDraft.receiptMeta) { setError("Please upload a receipt file"); return; }

    try {
      setSavingAdd(true);
      setError("");
      const res = await voucherAPI.createVoucher({
        title: addDraft.title.trim(),
        description: addDraft.description.trim() || undefined,
        amount: numericAmount,
        eventId,
        receiptFileUrl: addDraft.receiptMeta.fileUrl,
        receiptFileName: addDraft.receiptMeta.fileName,
        receiptMimeType: addDraft.receiptMeta.mimeType,
      });
      setVouchers((prev) => [...prev, res.voucher]);
      setShowAddForm(false);
      resetAddForm();
      flash("Expense added successfully");
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const detail = err.response?.data?.error;
      setError(detail ? `${msg || "Failed to add expense"}: ${detail}` : msg || "Failed to add expense");
    } finally {
      setSavingAdd(false);
    }
  };

  // ── Totals ──────────────────────────────────────────────────────────────────

  const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageTitle = eventTitle ? `${eventTitle} — Expenses` : "Event Expenses";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Vouchers"
        title={pageTitle}
        description="View, add, edit, and forward expense records for this event."
        actions={[
          { label: "← Back to vouchers", href: "/society/vouchers", variant: "outline" },
        ]}
      />

      <SectionCard title="Expense list" description="Each row represents one expense/voucher. Drafts can be edited before forwarding.">
        {successMsg && (
          <div className="mb-4 rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading expenses...</p>
        ) : (
          <>
            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4 text-right">Amount (BDT)</th>
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 pr-4">Receipt</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/50">
                  {vouchers.length === 0 && !showAddForm && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No expenses yet. Click &quot;+ Add Expense&quot; to create the first one.
                      </td>
                    </tr>
                  )}

                  {vouchers.map((voucher, idx) => {
                    const isDraft = voucher.status === "draft";
                    const isEditing = editingId === voucher.id;

                    if (isEditing) {
                      // ── Edit row ──────────────────────────────────────
                      return (
                        <tr key={voucher.id} className="bg-muted/30">
                          <td className="py-3 pr-4 align-top text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 pr-4 align-top">
                            <Input
                              value={editDraft.title}
                              onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                              placeholder="Expense title"
                              disabled={savingEdit}
                              className="h-8 min-w-[140px]"
                            />
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <Input
                              type="number"
                              min={0}
                              value={editDraft.amount}
                              onChange={(e) => setEditDraft((p) => ({ ...p, amount: e.target.value }))}
                              placeholder="Amount"
                              disabled={savingEdit}
                              className="h-8 w-28 text-right"
                            />
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <Input
                              value={editDraft.description}
                              onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                              placeholder="Optional notes"
                              disabled={savingEdit}
                              className="h-8 min-w-[120px]"
                            />
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="flex flex-col gap-1">
                              {editDraft.receiptMeta && (
                                <a
                                  href={editDraft.receiptMeta.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-xs text-blue-600 underline"
                                  title={editDraft.receiptMeta.fileName}
                                >
                                  {editDraft.receiptMeta.fileName.length > 20
                                    ? editDraft.receiptMeta.fileName.slice(0, 20) + "…"
                                    : editDraft.receiptMeta.fileName}
                                </a>
                              )}
                              <Input
                                type="file"
                                accept="application/pdf,image/jpeg,image/jpg,image/png"
                                onChange={(e) => handleEditReceiptUpload(e.target.files?.[0])}
                                disabled={editUploadingReceipt || savingEdit}
                                className="h-8 text-xs"
                              />
                              {editUploadingReceipt && (
                                <span className="text-xs text-muted-foreground">Uploading…</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[voucher.status]}`}>
                              {statusLabel[voucher.status]}
                            </span>
                          </td>
                          <td className="py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(voucher.id)}
                                disabled={savingEdit || editUploadingReceipt}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ── Normal row ───────────────────────────────────────
                    return (
                      <tr key={voucher.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{voucher.title}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{voucher.amount.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{voucher.description || "—"}</td>
                        <td className="py-3 pr-4">
                          {voucher.receiptFileUrl ? (
                            <a
                              href={voucher.receiptFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              {voucher.receiptFileName.length > 20
                                ? voucher.receiptFileName.slice(0, 20) + "…"
                                : voucher.receiptFileName || "View"}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[voucher.status]}`}>
                            {statusLabel[voucher.status]}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            {isDraft && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEdit(voucher)}
                                  disabled={!!editingId || deletingId === voucher.id || submittingId === voucher.id}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => deleteVoucher(voucher.id, voucher.title)}
                                  disabled={deletingId === voucher.id || !!editingId}
                                >
                                  {deletingId === voucher.id ? "Deleting…" : "Delete"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => forwardToAdmin(voucher.id)}
                                  disabled={submittingId === voucher.id || !!editingId}
                                >
                                  {submittingId === voucher.id ? "Forwarding…" : "Forward to admin"}
                                </Button>
                              </>
                            )}
                            {!isDraft && (
                              <a
                                href={voucher.receiptFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center rounded-2xl border border-border/70 px-3 text-xs hover:bg-muted"
                              >
                                View receipt
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── Add expense inline form ─────────────────────────── */}
                  {showAddForm && (
                    <tr className="bg-green-50/40">
                      <td className="py-3 pr-4 align-top text-muted-foreground">{vouchers.length + 1}</td>
                      <td className="py-3 pr-4 align-top">
                        <Input
                          ref={addTitleRef}
                          value={addDraft.title}
                          onChange={(e) => setAddDraft((p) => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. Venue deposit"
                          disabled={savingAdd}
                          className="h-8 min-w-[140px]"
                        />
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <Input
                          type="number"
                          min={0}
                          value={addDraft.amount}
                          onChange={(e) => setAddDraft((p) => ({ ...p, amount: e.target.value }))}
                          placeholder="Amount"
                          disabled={savingAdd}
                          className="h-8 w-28 text-right"
                        />
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <Input
                          value={addDraft.description}
                          onChange={(e) => setAddDraft((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Optional notes"
                          disabled={savingAdd}
                          className="h-8 min-w-[120px]"
                        />
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="flex flex-col gap-1">
                          {addDraft.receiptMeta && (
                            <span className="truncate text-xs text-green-700" title={addDraft.receiptMeta.fileName}>
                              ✓ {addDraft.receiptMeta.fileName.length > 20
                                ? addDraft.receiptMeta.fileName.slice(0, 20) + "…"
                                : addDraft.receiptMeta.fileName}
                            </span>
                          )}
                          <Input
                            type="file"
                            accept="application/pdf,image/jpeg,image/jpg,image/png"
                            onChange={(e) => handleAddReceiptUpload(e.target.files?.[0])}
                            disabled={addUploadingReceipt || savingAdd}
                            className="h-8 text-xs"
                          />
                          {addUploadingReceipt && (
                            <span className="text-xs text-muted-foreground">Uploading…</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          Draft
                        </span>
                      </td>
                      <td className="py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={saveAdd}
                            disabled={savingAdd || addUploadingReceipt}
                          >
                            {savingAdd ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelAdd} disabled={savingAdd}>
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* ── Total cost footer ──────────────────────────────────── */}
                {(vouchers.length > 0 || showAddForm) && (
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td colSpan={2} className="pb-1 pt-3 text-sm">
                        Total
                      </td>
                      <td className="pb-1 pt-3 text-right tabular-nums text-sm">
                        {totalAmount.toLocaleString()}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ── Add button below table if form not shown ──────────────── */}
            {!showAddForm && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingId(null);
                  }}
                >
                  + Add Expense
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
