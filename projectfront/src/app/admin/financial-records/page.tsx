"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Voucher, voucherAPI } from "@/lib/api";
import { EventReport, postEventAPI } from "@/lib/postEventApi";

type FinancialRecordRow = {
  id: string;
  eventName: string;
  type: "Expense" | "Post-event Report";
  amountLabel: string;
  organizer: string;
  dateLabel: string;
  receiptUrl?: string;
  reportId?: string;
  eventId?: string;
  sortTs: number;
};

function toSortTimestamp(dateValue?: string) {
  if (!dateValue) return 0;
  const ts = new Date(dateValue).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatRecordDate(dateValue: string) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapVoucherToRecord(voucher: Voucher): FinancialRecordRow {
  const recordDate = voucher.updatedAt || voucher.createdAt;
  return {
    id: voucher.id,
    eventName: voucher.event?.title || voucher.title,
    type: "Expense",
    amountLabel: `BDT ${voucher.amount.toLocaleString()}`,
    organizer: voucher.createdBy?.name || "Unknown organizer",
    dateLabel: formatRecordDate(recordDate),
    receiptUrl: voucher.receiptFileUrl,
    sortTs: toSortTimestamp(recordDate),
  };
}

function mapReportToRecord(report: EventReport): FinancialRecordRow {
  const actualAmount = report.eventInsights?.budgetActualTotal;
  const hasAmount = typeof actualAmount === "number" && Number.isFinite(actualAmount);
  const recordDate = report.submittedAt || report.updatedAt || report.createdAt;

  return {
    id: report.id,
    eventName: report.event?.title || "Unknown event",
    type: "Post-event Report",
    amountLabel: hasAmount ? `BDT ${Number(actualAmount).toLocaleString()}` : "",
    organizer: report.createdByName || "Unknown organizer",
    dateLabel: formatRecordDate(recordDate),
    reportId: report.id,
    eventId: report.eventId,
    sortTs: toSortTimestamp(recordDate),
  };
}

export default function FinancialRecordsPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [reports, setReports] = useState<EventReport[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadFinancialRecords = async () => {
      try {
        setLoading(true);
        setError("");
        const [voucherRes, reportRes] = await Promise.all([
          voucherAPI.getVouchers({ status: "submitted" }),
          postEventAPI.getAllReports({ status: "submitted" }),
        ]);
        setVouchers(voucherRes.vouchers || []);
        setReports(reportRes.reports || []);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || "Failed to load financial records");
      } finally {
        setLoading(false);
      }
    };

    loadFinancialRecords();
  }, []);

  const records = useMemo(() => {
    return [...vouchers.map(mapVoucherToRecord), ...reports.map(mapReportToRecord)].sort(
      (a, b) => b.sortTs - a.sortTs
    );
  }, [vouchers, reports]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) => {
      return [record.eventName, record.type, record.organizer].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [records, search]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Financial records"
        description="View submitted expense vouchers and submitted post-event reports for admin visibility."
      />

      <SectionCard title="Ledger" description="Search submitted records by event name, type, or organizer.">
        <div className="flex flex-wrap gap-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event name, type, or organizer"
            className="min-w-[220px] flex-1 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
          />
          <Button variant="outline" disabled>
            Submitted records only
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading submitted records...</p>
        ) : filteredRecords.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No submitted records available.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left">Event Name</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Amount</th>
                  <th className="px-6 py-3 text-left">Organizer</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-t border-border/50">
                    <td className="px-6 py-4 font-semibold text-foreground">{record.eventName}</td>
                    <td className="px-6 py-4">{record.type}</td>
                    <td className="px-6 py-4">{record.amountLabel}</td>
                    <td className="px-6 py-4">{record.organizer}</td>
                    <td className="px-6 py-4 text-muted-foreground">{record.dateLabel}</td>
                    <td className="px-6 py-4">
                      {record.type === "Post-event Report" && record.reportId && record.eventId ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/admin/post-event-reports/${record.reportId}/pdf?eventId=${encodeURIComponent(
                              record.eventId
                            )}`}
                          >
                            View report
                          </Link>
                        </Button>
                      ) : record.receiptUrl ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={record.receiptUrl} target="_blank" rel="noreferrer">
                            View receipt
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Not available
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
