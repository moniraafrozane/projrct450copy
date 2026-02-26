import api, { ApiResponse } from './api';

// User type definition
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'society';
  studentId?: string;
  program?: string;
  year?: number;
  societyName?: string;
  societyRole?: string;
  isActive: boolean;
  isEmailVerified?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Auth response type
export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
  role?: string;
}

// Register data
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'student' | 'admin' | 'society';
  studentId?: string;
  program?: string;
  year?: number;
  societyName?: string;
  societyRole?: string;
}

// Update profile data
export interface UpdateProfileData {
  name?: string;
  email?: string;
  program?: string;
  year?: number;
  societyName?: string;
  societyRole?: string;
}

// Change password data
export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Login user
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  
  if (response.data.success && response.data.token) {
    // Store token and user in localStorage
    localStorage.setItem('authToken', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

/**
 * Register new user
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', data);
  
  if (response.data.success && response.data.token) {
    // Store token and user in localStorage
    localStorage.setItem('authToken', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<{ success: boolean; user: User }>('/auth/me');
  return response.data.user;
};

/**
 * Update user profile
 */
export const updateProfile = async (data: UpdateProfileData): Promise<User> => {
  const response = await api.put<{ success: boolean; user: User }>('/auth/update', data);
  
  // Update user in localStorage
  localStorage.setItem('user', JSON.stringify(response.data.user));
  
  return response.data.user;
};

/**
 * Change password
 */
export const changePassword = async (data: ChangePasswordData): Promise<AuthResponse> => {
  const response = await api.put<AuthResponse>('/auth/updatepassword', data);
  
  if (response.data.success && response.data.token) {
    // Update token in localStorage
    localStorage.setItem('authToken', response.data.token);
  }
  
  return response.data;
};

/**
 * Get stored auth token
 */
export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

/**
 * Get stored user
 */
export const getStoredUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        return null;
      }
    }
  }
  return null;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

/**
 * Check if user has specific role
 */
export const hasRole = (role: string): boolean => {
  const user = getStoredUser();
  return user?.role === role;
};

/**
 * Redirect based on user role
 */
export const getRedirectPath = (user: User): string => {
  switch (user.role) {
    case 'admin':
      return '/admin';
    case 'society':
      return '/society';
    case 'student':
      return '/student';
    default:
      return '/';
  }
};
