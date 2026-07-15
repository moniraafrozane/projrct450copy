import api from "./api";

export interface VoucherSummaryEntry {
  id: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface EventVoucherData {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  voucherCount: number;
  approvedExpenses: number;
  pendingExpenses: number;
  draftExpenses: number;
  rejectedExpenses: number;
  vouchers: VoucherSummaryEntry[];
}

export interface VoucherSummary {
  totals: {
    vouchers: number;
    totalBudget: number;
    totalExpenses: number;
    pendingExpenses: number;
    remainingBudget: number;
    utilizationPercent: number;
  };
  events: EventVoucherData[];
}

export const voucherAPI = {
  getVoucherSummary: async (params?: {
    eventId?: string;
    budgetApplicationId?: string;
  }): Promise<{ success: boolean; summary: VoucherSummary }> => {
    const response = await api.get("/vouchers/summary", { params });
    return response.data;
  },

  getEventVouchers: async (eventId: string): Promise<{ success: boolean; vouchers: VoucherSummaryEntry[] }> => {
    const response = await api.get("/vouchers", { params: { eventId } });
    return response.data;
  },

  downloadSummaryReport: async (eventId: string, eventTitle: string): Promise<void> => {
    const response = await api.get("/vouchers/summary/excel", {
      params: { eventId },
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (eventTitle || "voucher-summary")
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-");
    a.download = `voucher-summary-${safeName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
