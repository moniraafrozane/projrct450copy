import axios, { AxiosError, AxiosInstance } from 'axios';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle common errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Handle 401 Unauthorized - Token expired or invalid
      if (error.response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Type definitions for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
}

export type NotificationType = 'event_created' | 'event_updated' | 'receipt_accepted';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  eventId?: string | null;
  eventTitle?: string | null;
  actorName?: string | null;
  actorSocietyName?: string | null;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: NotificationItem[];
}

export interface NotificationCountResponse {
  success: boolean;
  unreadCount: number;
}

export interface NotificationSingleResponse {
  success: boolean;
  notification: NotificationItem;
}

// Event-related types
export interface Event {
  id: string;
  title: string;
  description: string;
  eventType?: string;
  category?: string;
  venue: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  speaker?: string;
  eligibility?: string;
  keyTopics?: string;
  benefits?: string;
  maxParticipants?: number;
  registrationDeadline?: string;
  registrationFee: number;
  registrationDetails?: string;
  organizerId: string;
  organizerName: string;
  organizerContact?: string;
  contactInfo?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  isPublished: boolean;
  bannerImage?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    registrations: number;
  };
}

export interface EventRegistration {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  eventId: string;
  registrationDate: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  attended: boolean;
  attendedAt?: string | null;
  certificateRequestStatus: 'not_requested' | 'pending' | 'approved' | 'rejected';
  certificateRequestedAt?: string | null;
  certificateApprovedAt?: string | null;
  certificateFileUrl?: string | null;
  remarks?: string;
  event?: Event;
}

export type RegistrationLogEventType =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'attendance_marked'
  | 'certificate_requested'
  | 'comment_added'
  | 'certificate_uploaded'
  | 'certificate_ready'
  | 'email_sent'
  | 'receipt_generated';

export type RegistrationLogActorRole = 'student' | 'admin' | 'system';

export interface RegistrationLogEvent {
  id: string;
  registrationId: string;
  eventType: RegistrationLogEventType;
  actorRole: RegistrationLogActorRole;
  actorId?: string;
  actorName?: string;
  message: string;
  previousStatus?: 'confirmed' | 'waitlisted' | 'cancelled';
  nextStatus?: 'confirmed' | 'waitlisted' | 'cancelled';
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface RegistrationLogSummary {
  id: string;
  eventId: string;
  eventName: string;
  submittedAt: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  attended: boolean;
  attendedAt?: string | null;
  certificateRequestStatus: 'not_requested' | 'pending' | 'approved' | 'rejected';
  certificateRequestedAt?: string | null;
  registered: boolean;
  registrationDateTime: string;
  certificateIssueTime?: string | null;
  attendanceStatus: 'Attended' | 'Absent';
  participationType: 'Team' | 'Solo';
  position?: string | null;
  scoreOrMarks?: string | null;
  performanceRemarks?: string | null;
}

export interface RegistrationLogResponse {
  success: boolean;
  registration: RegistrationLogSummary;
  logs: RegistrationLogEvent[];
}

export interface EventsResponse {
  success: boolean;
  events: Event[];
  pagination?: {
    total: number;
    page: number;
    limit: number | null;
    pages: number;
  };
}

export interface EventResponse {
  success: boolean;
  event: Event;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  registration: EventRegistration;
}

// Event API functions
export const eventAPI = {
  // Get all events (public)
  getAllEvents: async (params?: {
    status?: string;
    category?: string;
    search?: string;
    upcoming?: boolean;
    page?: number;
    limit?: number;
  }): Promise<EventsResponse> => {
    const response = await api.get('/events', { params });
    return response.data;
  },

  // Get single event (public)
  getEventById: async (eventId: string): Promise<EventResponse> => {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  },

  // Create event (protected - society/admin)
  createEvent: async (eventData: {
    title: string;
    description: string;
    category?: string;
    venue: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    maxParticipants?: number;
    registrationDeadline?: string;
    registrationFee?: number;
    organizerName: string;
    organizerContact?: string;
    bannerImage?: string;
  }): Promise<EventResponse> => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  // Register for an event (protected)
  registerForEvent: async (
    eventId: string,
    registrationData?: {
      fullName?: string;
      email?: string;
      userPhone?: string;
      registrationNumber?: string;
      teamName?: string;
      institution?: string;
      remarks?: string;
    }
  ): Promise<RegistrationResponse> => {
    const response = await api.post(`/events/${eventId}/register`, registrationData || {});
    return response.data;
  },

  // Cancel event registration (protected)
  cancelRegistration: async (eventId: string): Promise<ApiResponse> => {
    const response = await api.delete(`/events/${eventId}/register`);
    return response.data;
  },

  // Get user's event registrations (protected)
  getMyRegistrations: async (): Promise<{ success: boolean; registrations: EventRegistration[] }> => {
    const response = await api.get('/events/my/registrations');
    return response.data;
  },

  // Get detailed timeline/log for one registration (protected)
  getRegistrationLog: async (
    eventId: string,
    registrationId: string
  ): Promise<RegistrationLogResponse> => {
    const response = await api.get(`/events/${eventId}/registrations/${registrationId}/log`);
    return response.data;
  },

  applyForCertificate: async (
    eventId: string,
    registrationId: string
  ): Promise<{ success: boolean; message: string; registration: EventRegistration }> => {
    const response = await api.post(`/events/${eventId}/registrations/${registrationId}/certificate-request`, {});
    return response.data;
  },

  // Get user's created events (protected - society/admin)
  getMyEvents: async (): Promise<EventsResponse> => {
    const response = await api.get('/events/my/events');
    return response.data;
  },

  // Get all society-created events (protected)
  getSocietyEvents: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<EventsResponse> => {
    const response = await api.get('/events/society/all', { params });
    return response.data;
  },

  // Get all events manageable by society/admin users (protected)
  getManageableEvents: async (): Promise<EventsResponse> => {
    const response = await api.get('/events/manage/all');
    return response.data;
  },

  // Update event (protected - owner/admin)
  updateEvent: async (eventId: string, eventData: Partial<Event>): Promise<EventResponse> => {
    const response = await api.put(`/events/${eventId}`, eventData);
    return response.data;
  },

  // Delete event (protected - owner/admin)
  deleteEvent: async (eventId: string): Promise<ApiResponse> => {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
  },

  // Get event statistics (protected - organizer/admin)
  getEventStats: async (eventId: string): Promise<ApiResponse> => {
    const response = await api.get(`/events/${eventId}/stats`);
    return response.data;
  },
};

export const notificationAPI = {
  getMyNotifications: async (params?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<NotificationsResponse> => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<NotificationCountResponse> => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<NotificationSingleResponse> => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse & { updatedCount?: number }> => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
};

// ─── Analytics Reports API ─────────────────────────────────────────
export type AnalyticsMetricKey =
  | 'total_events_per_year'
  | 'total_budget_per_year'
  | 'average_budget_per_event'
  | 'total_student_participations';

export interface AnalyticsMetricDefinition {
  key: AnalyticsMetricKey;
  label: string;
  description: string;
  format: 'number' | 'currency';
}

export interface AnalyticsReportMetric {
  key: AnalyticsMetricKey;
  label: string;
  description: string;
  format: 'number' | 'currency';
  value: number;
  autoValue: number;
  source: 'auto' | 'manual';
}

export interface AnalyticsReport {
  id: string;
  title: string;
  reportYear: number;
  notes?: string | null;
  metricKeys: AnalyticsMetricKey[];
  metricValues: AnalyticsReportMetric[];
  filters?: { year?: number } | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsReportOptionsResponse {
  success: boolean;
  metrics: AnalyticsMetricDefinition[];
  defaultYear: number;
}

export interface AnalyticsReportListResponse {
  success: boolean;
  reports: AnalyticsReport[];
}

export interface MonthlyBudgetEvent {
  name: string;
  date: string;
  budget: number;
}

export interface MonthlyBudgetEventsResponse {
  success: boolean;
  events: MonthlyBudgetEvent[];
  totalBudget: number;
  eventCount: number;
}

export interface AnalyticsReportResponse {
  success: boolean;
  report: AnalyticsReport;
}

export interface CreateAnalyticsReportPayload {
  title: string;
  year: number;
  notes?: string;
  metricKeys: AnalyticsMetricKey[];
  metricValues?: Partial<Record<AnalyticsMetricKey, number | string | null | undefined>>;
}

export const analyticsReportAPI = {
  getMetricOptions: async (): Promise<AnalyticsReportOptionsResponse> => {
    const response = await api.get('/admin/reports/options');
    return response.data;
  },

  getReports: async (): Promise<AnalyticsReportListResponse> => {
    const response = await api.get('/admin/reports');
    return response.data;
  },

  getMonthlyBudgetEvents: async (): Promise<MonthlyBudgetEventsResponse> => {
    const response = await api.get('/admin/reports/monthly-budget');
    return response.data;
  },

  getReport: async (reportId: string): Promise<AnalyticsReportResponse> => {
    const response = await api.get(`/admin/reports/${reportId}`);
    return response.data;
  },

  createReport: async (payload: CreateAnalyticsReportPayload): Promise<AnalyticsReportResponse> => {
    const response = await api.post('/admin/reports', payload);
    return response.data;
  },

  downloadReport: async (reportId: string, format: 'pdf' | 'xlsx' = 'pdf'): Promise<void> => {
    const response = await api.get(`/admin/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${reportId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// Position API endpoints
export const positionAPI = {
  // Initialize positions
  initPositions: async (): Promise<ApiResponse> => {
    const response = await api.post('/positions/init');
    return response.data;
  },

  // Get all positions
  getPositions: async (): Promise<ApiResponse> => {
    const response = await api.get('/positions');
    return response.data;
  },

  // Get position by ID
  getPositionById: async (id: string): Promise<ApiResponse> => {
    const response = await api.get(`/positions/${id}`);
    return response.data;
  },

  // Get available positions (not assigned)
  getAvailablePositions: async (): Promise<ApiResponse> => {
    const response = await api.get('/positions/available');
    return response.data;
  },

  // Get user's positions
  getUserPositions: async (userId: string): Promise<ApiResponse> => {
    const response = await api.get(`/positions/user/${userId}`);
    return response.data;
  },

  // Assign position to user (by position ID)
  assignPosition: async (positionId: string, userId: string): Promise<ApiResponse> => {
    const response = await api.post('/positions/assign', { positionId, userId });
    return response.data;
  },

  // Assign position by role payload
  assignPositionByRolePayload: async (payload: {
    name: string;
    studentId?: string;
    email?: string;
    role:
      | 'VICE_PRESIDENT'
      | 'GENERAL_SECRETARY'
      | 'EVENT_CULTURAL_SECRETARY'
      | 'SPORTS_SECRETARY'
      | 'PUBLICATION_SECRETARY'
      | 'ASSISTANT_EVENT_CULTURAL_SECRETARY'
      | 'EXECUTIVE_MEMBER';
  }): Promise<ApiResponse> => {
    const response = await api.post('/positions/assign', payload);
    return response.data;
  },

  // Assign position by title
  assignPositionByTitle: async (positionTitle: string, userId: string): Promise<ApiResponse> => {
    const response = await api.post('/positions/assign-by-title', { positionTitle, userId });
    return response.data;
  },

  // Unassign position
  unassignPosition: async (positionId: string): Promise<ApiResponse> => {
    const response = await api.put(`/positions/${positionId}/unassign`);
    return response.data;
  },
};

// ─── User API ───────────────────────────────────────────────────────
interface UserListResponse {
  success: boolean;
  count: number;
  users: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    roles: string[];
    studentId?: string;
    societyName?: string;
    societyRole?: string;
    year?: number;
    isActive: boolean;
    createdAt: string;
  }[];
}

export type UserListItem = UserListResponse['users'][number];

export const userAPI = {
  getUsers: async (): Promise<UserListResponse> => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  closeUser: async (
    id: string,
    reason: string
  ): Promise<ApiResponse<{ id: string; isActive: boolean }>> => {
    const response = await api.put(`/auth/users/${id}/close`, { reason });
    return response.data;
  },
};

// ─── Committee types ────────────────────────────────────────────────
export type CommitteeRole =
  | 'VICE_PRESIDENT'
  | 'GENERAL_SECRETARY'
  | 'EVENT_CULTURAL_SECRETARY'
  | 'SPORTS_SECRETARY'
  | 'PUBLICATION_SECRETARY'
  | 'ASSISTANT_EVENT_CULTURAL_SECRETARY'
  | 'EXECUTIVE_MEMBER';

export interface CommitteeMember {
  id: string;
  committeeId: string;
  userId: string;
  role: CommitteeRole;
  assignedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentId?: string;
    roles: string[];
  };
}

export interface Committee {
  id: string;
  name: string;
  termStart: string;
  termEnd: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members: CommitteeMember[];
  _count?: { members: number };
}

// ─── Committee API ──────────────────────────────────────────────────
export const committeeAPI = {
  createCommittee: async (data: {
    name: string;
    termStart: string;
    termEnd: string;
  }): Promise<ApiResponse<Committee>> => {
    const response = await api.post('/committees', data);
    return response.data;
  },

  getCommittees: async (): Promise<{ success: boolean; committees: Committee[] }> => {
    const response = await api.get('/committees');
    return response.data;
  },

  getActiveCommittee: async (): Promise<{ success: boolean; committee: Committee | null }> => {
    const response = await api.get('/committees/active');
    return response.data;
  },

  getCommitteeById: async (id: string): Promise<{ success: boolean; committee: Committee }> => {
    const response = await api.get(`/committees/${id}`);
    return response.data;
  },

  updateCommittee: async (
    id: string,
    data: { name?: string; termStart?: string; termEnd?: string }
  ): Promise<ApiResponse<Committee>> => {
    const response = await api.put(`/committees/${id}`, data);
    return response.data;
  },

  addMember: async (
    committeeId: string,
    data: { userId: string; role: CommitteeRole }
  ): Promise<ApiResponse> => {
    const response = await api.post(`/committees/${committeeId}/members`, data);
    return response.data;
  },

  removeMember: async (committeeId: string, memberId: string): Promise<ApiResponse> => {
    const response = await api.delete(`/committees/${committeeId}/members/${memberId}`);
    return response.data;
  },

  updateMemberRole: async (
    committeeId: string,
    memberId: string,
    data: { role: CommitteeRole }
  ): Promise<ApiResponse> => {
    const response = await api.put(`/committees/${committeeId}/members/${memberId}`, data);
    return response.data;
  },

  deactivateCommittee: async (id: string): Promise<ApiResponse> => {
    const response = await api.put(`/committees/${id}/deactivate`);
    return response.data;
  },
};

// ─── Society Application types ──────────────────────────────────────
export type ApplicationType = 'fund_withdrawal' | 'event_approval' | 'resource_request' | 'budget_breakdown';
export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'returned';

export interface BudgetBreakdownSection {
  key: string;
  title: string;
  helper: string;
  amount: number;
  notes: string;
  optional: boolean;
}

export interface BudgetBreakdownContent {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventStartTime?: string;
  eventVenue?: string;
  organizerName?: string;
  sections: BudgetBreakdownSection[];
  calculatedTotal: number;
  overrideAmount: number | null;
  totalAmount: number;
}

export interface SocietyApplication {
  id: string;
  type: ApplicationType;
  subject: string;
  content: Record<string, any>;
  status: ApplicationStatus;
  adminNotes?: string;
  memberNotes: MemberNote[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberNote {
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

// ─── Society Application API ────────────────────────────────────────
interface ApplicationResponse {
  success: boolean;
  message?: string;
  application: SocietyApplication;
}

interface ApplicationPdfFile {
  blob: Blob;
  fileName: string;
}

export const applicationAPI = {
  createApplication: async (data: {
    type: ApplicationType;
    subject: string;
    content: Record<string, any>;
  }): Promise<ApplicationResponse> => {
    const response = await api.post('/applications', data);
    return response.data;
  },

  createBudgetBreakdown: async (data: {
    eventId: string;
    sections: BudgetBreakdownSection[];
    calculatedTotal: number;
    overrideAmount: number | null;
    totalAmount: number;
  }): Promise<ApplicationResponse> => {
    const response = await api.post('/applications/budgets', data);
    return response.data;
  },

  getBudgetBreakdowns: async (): Promise<{ success: boolean; applications: SocietyApplication[] }> => {
    const response = await api.get('/applications/budgets');
    return response.data;
  },

  getApplications: async (params?: {
    type?: ApplicationType;
    status?: ApplicationStatus;
  }): Promise<{ success: boolean; applications: SocietyApplication[] }> => {
    const response = await api.get('/applications', { params });
    return response.data;
  },

  getApplicationById: async (id: string): Promise<ApplicationResponse> => {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  },

  getApplicationPdfFile: async (
    id: string,
    options?: { download?: boolean }
  ): Promise<ApplicationPdfFile> => {
    const response = await api.get(`/applications/${id}/pdf`, {
      params: { download: options?.download ? 1 : 0 },
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^\";]+)"?/i);
    const fileName = match?.[1] ? decodeURIComponent(match[1]) : `application-${id}.pdf`;

    return {
      blob: response.data as Blob,
      fileName,
    };
  },

  getApplicationPrintFile: async (id: string): Promise<ApplicationPdfFile> => {
    const response = await api.get(`/applications/${id}/print`, {
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^\";]+)"?/i);
    const fileName = match?.[1] ? decodeURIComponent(match[1]) : `application-${id}.pdf`;

    return {
      blob: response.data as Blob,
      fileName,
    };
  },

  updateApplication: async (
    id: string,
    data: { type?: ApplicationType; subject?: string; content?: Record<string, any> }
  ): Promise<ApplicationResponse> => {
    const response = await api.put(`/applications/${id}`, data);
    return response.data;
  },

  submitApplication: async (id: string): Promise<ApplicationResponse> => {
    const response = await api.put(`/applications/${id}/submit`, {});
    return response.data;
  },

  forwardApplication: async (id: string): Promise<ApplicationResponse> => {
    const response = await api.put(`/applications/${id}/forward`, {});
    return response.data;
  },

  approveApplication: async (id: string): Promise<ApplicationResponse> => {
    const response = await api.put(`/applications/${id}/approve`, {});
    return response.data;
  },

  returnApplication: async (id: string, adminNotes: string): Promise<ApplicationResponse> => {
    const response = await api.put(`/applications/${id}/return`, { adminNotes });
    return response.data;
  },

  addNote: async (id: string, text: string): Promise<ApplicationResponse> => {
    const response = await api.post(`/applications/${id}/notes`, { text });
    return response.data;
  },
};

export type VoucherStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface Voucher {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  status: VoucherStatus;
  receiptFileUrl: string;
  receiptFileName: string;
  receiptMimeType: string;
  eventId: string;
  budgetApplicationId?: string | null;
  createdById: string;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  adminDecisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  event?: {
    id: string;
    title: string;
    eventDate: string;
  };
  budgetApplication?: {
    id: string;
    type: string;
    status: string;
    subject: string;
    content: Record<string, any>;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export const voucherAPI = {
  getVouchers: async (params?: {
    status?: VoucherStatus;
    eventId?: string;
    budgetApplicationId?: string;
    createdById?: string;
  }): Promise<{ success: boolean; vouchers: Voucher[] }> => {
    const response = await api.get('/vouchers', { params });
    return response.data;
  },

  createVoucher: async (data: {
    title: string;
    description?: string;
    amount: number;
    eventId: string;
    budgetApplicationId?: string;
    receiptFileUrl: string;
    receiptFileName: string;
    receiptMimeType: string;
  }): Promise<{ success: boolean; message?: string; voucher: Voucher }> => {
    const response = await api.post('/vouchers', data);
    return response.data;
  },

  submitVoucher: async (id: string): Promise<{ success: boolean; message?: string; voucher: Voucher }> => {
    const response = await api.put(`/vouchers/${id}/submit`, {});
    return response.data;
  },

  updateVoucher: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      amount?: number;
      receiptFileUrl?: string;
      receiptFileName?: string;
      receiptMimeType?: string;
      budgetApplicationId?: string | null;
    }
  ): Promise<{ success: boolean; message?: string; voucher: Voucher }> => {
    const response = await api.put(`/vouchers/${id}`, data);
    return response.data;
  },

  deleteVoucher: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete(`/vouchers/${id}`);
    return response.data;
  },

  uploadReceiptFile: async (file: File): Promise<{
    success: boolean;
    message: string;
    fileUrl: string;
    fileName: string;
    storedName: string;
    mimeType: string;
  }> => {
    const formData = new FormData();
    formData.append('receipt', file);
    const response = await api.post('/upload/receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export type StudentFeePaymentStatus = 'pending' | 'paid';
export type StudentFeeReceiptStatus = 'pending' | 'accepted' | 'rejected';

export interface StudentFeePayment {
  id: string;
  reference: string;
  paymentDate: string;
  amount: number;
  notes?: string | null;
  status: StudentFeePaymentStatus;
  verifiedAt?: string | null;
}

export interface StudentFeeReceipt {
  id: string;
  paymentId: string;
  studentId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  status: StudentFeeReceiptStatus;
  adminNote?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payment: StudentFeePayment;
  student?: {
    id: string;
    name: string;
    email: string;
    studentId?: string | null;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

interface StudentAffairsReceiptResponse {
  success: boolean;
  message?: string;
  receipt: StudentFeeReceipt;
  payment?: StudentFeePayment;
}

export const studentAffairsAPI = {
  uploadReceiptFile: async (file: File): Promise<{
    success: boolean;
    message: string;
    fileUrl: string;
    fileName: string;
    storedName: string;
    mimeType: string;
  }> => {
    const formData = new FormData();
    formData.append('receipt', file);
    const response = await api.post('/upload/receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  createReceipt: async (data: {
    reference: string;
    paymentDate: string;
    amount: number;
    notes?: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
  }): Promise<StudentAffairsReceiptResponse> => {
    const response = await api.post('/student-affairs/receipts', data);
    return response.data;
  },

  getReceipts: async (params?: {
    status?: StudentFeeReceiptStatus;
  }): Promise<{ success: boolean; receipts: StudentFeeReceipt[] }> => {
    const response = await api.get('/student-affairs/receipts', { params });
    return response.data;
  },

  getMyReceipts: async (): Promise<{ success: boolean; receipts: StudentFeeReceipt[] }> => {
    const response = await api.get('/student-affairs/receipts/my');
    return response.data;
  },

  getReceiptById: async (id: string): Promise<StudentAffairsReceiptResponse> => {
    const response = await api.get(`/student-affairs/receipts/${id}`);
    return response.data;
  },

  reviewReceipt: async (
    id: string,
    data: { decision: 'accepted' | 'rejected'; adminNote?: string }
  ): Promise<StudentAffairsReceiptResponse> => {
    const response = await api.put(`/student-affairs/receipts/${id}/decision`, data);
    return response.data;
  },
};

// ─── Post-Event Reporting ─────────────────────────────────────────────────────

export type EventReportStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'returned';
export type MediaType = 'photos' | 'video' | 'document';

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
  summary: 'Over budget' | 'Under budget' | 'On budget';
}

export const postEventAPI = {
  getReports: async (eventId: string): Promise<{ success: boolean; reports: EventReport[] }> => {
    const response = await api.get(`/events/${eventId}/post-event-reports`);
    return response.data;
  },

  getAllReports: async (): Promise<{ success: boolean; reports: EventReport[] }> => {
    const response = await api.get('/post-event-reports');
    return response.data;
  },

  createReport: async (
    eventId: string,
    data?: { budgetApplicationId?: string }
  ): Promise<{ success: boolean; report: EventReport }> => {
    const response = await api.post(`/events/${eventId}/post-event-reports`, data ?? {});
    return response.data;
  },

  getReport: async (
    eventId: string,
    reportId: string
  ): Promise<{ success: boolean; report: EventReport }> => {
    const response = await api.get(`/events/${eventId}/post-event-reports/${reportId}`);
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

  reviewReport: async (
    eventId: string,
    reportId: string,
    data: { action: 'approve' | 'return' | 'start_review'; adminNotes?: string }
  ): Promise<{ success: boolean; message: string; report: EventReport }> => {
    const response = await api.post(`/events/${eventId}/post-event-reports/${reportId}/review`, data);
    return response.data;
  },

  uploadMedia: async (
    eventId: string,
    reportId: string,
    file: File,
    mediaType: MediaType,
    description?: string
  ): Promise<{ success: boolean; media: EventReportMedia }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mediaType', mediaType);
    if (description) formData.append('description', description);
    const response = await api.post(
      `/events/${eventId}/post-event-reports/${reportId}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteMedia: async (
    eventId: string,
    reportId: string,
    mediaId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(
      `/events/${eventId}/post-event-reports/${reportId}/media/${mediaId}`
    );
    return response.data;
  },

  getBudgetComparison: async (
    eventId: string
  ): Promise<{ success: boolean; budgetComparison: BudgetComparison }> => {
    const response = await api.get(`/events/${eventId}/budget-comparison`);
    return response.data;
  },

  downloadTemplate: async (eventId: string): Promise<void> => {
    const response = await api.get(`/events/${eventId}/post-event-template`, { responseType: 'blob' });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disp: string = response.headers['content-disposition'] || '';
    const m = disp.match(/filename="(.+)"/);
    a.download = m ? m[1] : 'post-event-template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadGenericTemplate: async (): Promise<void> => {
    const response = await api.get('/post-event-reports/template', { responseType: 'blob' });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'post-event-template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── Admin Audit Log API ───────────────────────────────────────────

export interface AdminAuditLog {
  id: string;
  action: string;
  module: string;
  description: string;
  actorId: string;
  actorEmail: string;
  actorName?: string | null;
  actorRole: string;
  resourceId?: string | null;
  resourceType?: string | null;
  resourceName?: string | null;
  previousValue?: any;
  newValue?: any;
  metadata?: any;
  ipAddress?: string | null;
  createdAt: string;
}

export const auditLogAPI = {
  getAuditLogs: async (params?: {
    module?: string;
    action?: string;
    resourceType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    logs: AdminAuditLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }> => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  },

  getResourceAuditTrail: async (
    resourceType: string,
    resourceId: string
  ): Promise<{ success: boolean; logs: AdminAuditLog[] }> => {
    const response = await api.get(`/admin/audit-logs/${resourceType}/${resourceId}`);
    return response.data;
  },
};
