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
  remarks?: string;
}

export interface EventsResponse {
  success: boolean;
  events: Event[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
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
  registerForEvent: async (eventId: string, remarks?: string): Promise<RegistrationResponse> => {
    const response = await api.post(`/events/${eventId}/register`, { remarks });
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

  // Get user's created events (protected - society/admin)
  getMyEvents: async (): Promise<EventsResponse> => {
    const response = await api.get('/events/my/events');
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
