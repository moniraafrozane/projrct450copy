"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Voucher, voucherAPI } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoucherSummaryReportProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VoucherSummaryReport({
  eventId,
  eventTitle,
  isOpen,
  onClose,
}: VoucherSummaryReportProps) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const loadVouchers = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await voucherAPI.getVouchers({ eventId });
        setVouchers(response.vouchers || []);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load vouchers");
      } finally {
        setLoading(false);
      }
    };

    loadVouchers();
  }, [isOpen, eventId]);

  const approvedVouchers = vouchers.filter((v) => v.status === "approved");
  const totalAmount = approvedVouchers.reduce((sum, v) => sum + v.amount, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voucher Summary Report</DialogTitle>
          <DialogDescription>
            A printable summary of all expense vouchers for {eventTitle}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading vouchers...
          </div>
        ) : approvedVouchers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No approved vouchers found for this event.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Printable Report */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      DATE
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      PURPOSES
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">
                      VOUCHER
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold">
                      TAKA
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      COMMENTS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {approvedVouchers.map((voucher, index) => (
                    <tr key={voucher.id}>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {voucher.createdAt
                          ? new Date(voucher.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }
                            )
                          : "-"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {voucher.title}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-sm font-medium">
                        {voucher.amount.toLocaleString("en-BD")}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {voucher.description || "-"}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="font-semibold bg-gray-50">
                    <td
                      colSpan={3}
                      className="border border-gray-300 px-4 py-2 text-sm text-right"
                    >
                      Total
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right text-sm">
                      {totalAmount.toLocaleString("en-BD")}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-sm">
                      -
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Print Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={handlePrint}>Print Report</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
