import api from "./api";

export interface PendingCertificate {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  registrationNumber?: string;
  certificateRequestedAt: string;
  certificateFileUrl?: string;
  attended: boolean;
  event: {
    id: string;
    title: string;
  };
}

export interface CertificateResponse {
  success: boolean;
  message: string;
  registration?: any;
  fileUrl?: string;
  notificationMessage?: string;
}

export interface PendingCertificatesResponse {
  success: boolean;
  message: string;
  pendingCertificates: PendingCertificate[];
  count: number;
}

export const certificateAPI = {
  /**
   * Fetch all pending certificate applications for an event
   */
  getPendingCertificates: async (eventId: string) => {
    const response = await api.get(`/events/${eventId}/pending-certificates`);
    return response.data;
  },

  /**
   * Upload a certificate PDF file for a student
   */
  uploadCertificate: async (eventId: string, registrationId: string, file: File) => {
    const formData = new FormData();
    formData.append("certificate", file);

    const response = await api.post(
      `/events/${eventId}/registrations/${registrationId}/certificate/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Approve a certificate and notify the student
   */
  approveCertificate: async (eventId: string, registrationId: string) => {
    const response = await api.post(
      `/events/${eventId}/registrations/${registrationId}/certificate/approve`
    );
    return response.data;
  },

  /**
   * Reject a certificate request
   */
  rejectCertificate: async (eventId: string, registrationId: string) => {
    const response = await api.post(
      `/events/${eventId}/registrations/${registrationId}/certificate/reject`
    );
    return response.data;
  },
};
