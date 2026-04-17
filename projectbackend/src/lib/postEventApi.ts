import api from "./api";

export type EventReportStatus = "draft" | "submitted" | "under_review" | "approved" | "returned";
export type MediaType = "photos" | "video" | "document";

export interface AttendeeEntry {
  name: string;
  id?: string;
  email?: string;
  department?: string;
  attended: boolean;
  remarks?: string;
}

export interface AttendanceRecord {
  totalRegistered: number;
  totalAttended: number;
  attendeeList: AttendeeEntry[];
}

export interface EventInsights {
  keyHighlights: string;
  challengesFaced: string;
  improvementsSuggested: string;
  overallAssessment: string;
  budgetPlannedTotal?: number | null;
  budgetActualTotal?: number | null;
}

export interface EventReportMedia {
  id: string;
  reportId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: MediaType;
  description?: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface EventReport {
  id: string;
  eventId: string;
  attendanceRecord?: AttendanceRecord | null;
  eventInsights?: EventInsights | null;
  expenseNotes?: string | null;
  budgetApplicationId?: string | null;
  status: EventReportStatus;
  adminNotes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdById: string;
  createdByName: string;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  media?: EventReportMedia[];
  event?: { id: string; title: string; eventDate: string; venue: string };
}

export interface BudgetComparison {
  event: { id: string; title: string };
  planned: {
    total: number;
    sections: { title: string; amount: number; purpose: string }[];
    source: { id: string; subject: string; status: string } | null;
  };
  actual: {
    total: number;
    approvedTotal: number;
    vouchers: { id: string; title: string; description?: string; amount: number; status: string; createdAt: string }[];
  };
  variance: number;
  variancePercent: string | null;
  summary: "Over budget" | "Under budget" | "On budget";
}

export const postEventAPI = {
  getReports: async (eventId: string): Promise<{ success: boolean; reports: EventReport[] }> => {
    const response = await api.get(`/events/${eventId}/post-event-reports`);
    return response.data;
  },

  getReport: async (
    eventId: string,
    reportId: string
  ): Promise<{ success: boolean; report: EventReport }> => {
    const response = await api.get(`/events/${eventId}/post-event-reports/${reportId}`);
    return response.data;
  },

  getAllReports: async (params?: {
    status?: EventReportStatus;
  }): Promise<{ success: boolean; reports: EventReport[] }> => {
    const response = await api.get("/post-event-reports", { params });
    return response.data;
  },

  createReport: async (
    eventId: string,
    data?: { budgetApplicationId?: string }
  ): Promise<{ success: boolean; report: EventReport }> => {
    const response = await api.post(`/events/${eventId}/post-event-reports`, data ?? {});
    return response.data;
  },

  updateReport: async (
    eventId: string,
    reportId: string,
    data: {
      attendanceRecord?: AttendanceRecord;
      eventInsights?: EventInsights;
      expenseNotes?: string;
      budgetApplicationId?: string | null;
    }
  ): Promise<{ success: boolean; report: EventReport }> => {
    const response = await api.put(`/events/${eventId}/post-event-reports/${reportId}`, data);
    return response.data;
  },

  submitReport: async (
    eventId: string,
    reportId: string
  ): Promise<{ success: boolean; message: string; report: EventReport }> => {
    const response = await api.post(`/events/${eventId}/post-event-reports/${reportId}/submit`, {});
    return response.data;
  },

  getBudgetComparison: async (
    eventId: string
  ): Promise<{ success: boolean; budgetComparison: BudgetComparison }> => {
    const response = await api.get(`/events/${eventId}/budget-comparison`);
    return response.data;
  },

  downloadGenericTemplate: async (): Promise<void> => {
    const response = await api.get("/post-event-reports/template", { responseType: "blob" });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "post-event-template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadEventReport: async (eventId: string, eventTitle?: string): Promise<void> => {
    const response = await api.get(`/events/${eventId}/post-event-template`, { responseType: "blob" });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (eventTitle || "event").replace(/[^a-z0-9\s-]/gi, "").trim().replace(/\s+/g, "-");
    a.download = `post-event-report-${safeName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadReportPdf: async (
    eventId: string,
    reportId: string,
    eventTitle?: string
  ): Promise<void> => {
    const response = await api.get(`/events/${eventId}/post-event-reports/${reportId}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (eventTitle || "post-event-report")
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-");
    a.download = `${safeName || "post-event-report"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getReportPdfFile: async (
    eventId: string,
    reportId: string
  ): Promise<{ blob: Blob; fileName: string }> => {
    const response = await api.get(`/events/${eventId}/post-event-reports/${reportId}/pdf`, {
      responseType: "blob",
    });
    const disposition = String(response.headers?.["content-disposition"] || "");
    const match = disposition.match(/filename="?([^\"]+)"?/i);
    return {
      blob: new Blob([response.data], { type: "application/pdf" }),
      fileName: match?.[1] || "post-event-report.pdf",
    };
  },
};
