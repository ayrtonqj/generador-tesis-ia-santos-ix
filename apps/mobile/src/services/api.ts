import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/authStore';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: añade JWT ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor: maneja 401 ────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const advancesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/advances', { params }),
  getById: (id: string) => api.get(`/advances/${id}`),
};

export const analysisApi = {
  getByAdvance: (advanceId: string) =>
    api.get(`/ai-analysis/${advanceId}`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/mark-all-read'),
  registerToken: (token: string, platform: string) =>
    api.post('/notifications/push-token', { token, platform }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

export const reportsApi = {
  downloadUrl: (advanceId: string) =>
    `${BASE_URL}/api/reports/advance/${advanceId}/pdf`,
};

export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: { name?: string; signature?: string }) =>
    api.patch('/users/me', data),
};

export const programsApi = {
  list: () => api.get('/programs'),
};
