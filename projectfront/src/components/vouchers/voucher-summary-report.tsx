"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { voucherAPI, VoucherSummaryEntry } from "@/lib/voucherApi";

interface VoucherSummaryReportProps {
  eventId: string;
  eventTitle: string;
  onClose?: () => void;
}

export function VoucherSummaryReport({ eventId, eventTitle, onClose }: VoucherSummaryReportProps) {
  const [vouchers, setVouchers] = useState<VoucherSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const loadVouchers = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await voucherAPI.getEventVouchers(eventId);
        setVouchers(response.vouchers || []);
      } catch (err) {
        setError("Failed to load vouchers");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadVouchers();
  }, [eventId]);

  const handleDownloadPrint = async () => {
    try {
      setDownloading(true);
      await voucherAPI.downloadSummaryReport(eventId, eventTitle);
    } catch (err) {
      setError("Failed to download report");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-BD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);
  const approvedVouchers = vouchers.filter((v) => v.status === "approved");
  const approvedTotal = approvedVouchers.reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="space-y-4 print:bg-white print:text-black">
      <style>{`
        @media print {
          .no-print { display: none; }
          .print-only { display: block; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .print-header { text-align: center; margin-bottom: 20px; }
          .print-header h2 { margin: 0; font-size: 18px; }
          .print-header p { margin: 4px 0; font-size: 12px; color: #666; }
        }
      `}</style>
      {error && (
        <div className="rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="no-print flex justify-between items-center">
        <h3 className="text-lg font-semibold">Voucher Summary Report - {eventTitle}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={loading || vouchers.length === 0 || isPrinting}
          >
            {isPrinting ? "Printing..." : "Print"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPrint}
            disabled={loading || downloading || vouchers.length === 0}
          >
            {downloading ? "Downloading..." : "Print/Download"}
          </Button>
          {onClose && (
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="print-only text-center mb-6 hidden print:block">
        <h2 className="text-2xl font-bold mb-2">Voucher Summary Report</h2>
        <p className="text-sm text-gray-600">{eventTitle}</p>
        <p className="text-xs text-gray-500">Generated on {new Date().toLocaleDateString("en-GB")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading vouchers...</p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No vouchers found for this event.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">DATE</th>
                <th className="px-4 py-3 text-left font-semibold">PURPOSES</th>
                <th className="px-4 py-3 text-left font-semibold">VOUCHER</th>
                <th className="px-4 py-3 text-right font-semibold">TAKA</th>
                <th className="px-4 py-3 text-left font-semibold">COMMENTS</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher, index) => (
                <tr key={voucher.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-4 py-3">{formatDate(voucher.createdAt)}</td>
                  <td className="px-4 py-3">{voucher.title}</td>
                  <td className="px-4 py-3 text-center">{index + 1}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(voucher.amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        voucher.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : voucher.status === "submitted" || voucher.status === "under_review"
                          ? "bg-blue-100 text-blue-700"
                          : voucher.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {voucher.status}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-secondary/20 font-semibold border-t-2 border-border">
                <td colSpan={3} className="px-4 py-3 text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(approvedTotal)}</td>
                <td className="px-4 py-3">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>Total Vouchers: {vouchers.length}</p>
        <p>Approved Vouchers: {approvedVouchers.length}</p>
        <p>Total Approved Amount: {formatCurrency(approvedTotal)}</p>
      </div>
    </div>
  );
}
