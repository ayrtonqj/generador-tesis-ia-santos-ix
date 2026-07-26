import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar JWT
api.interceptors.request.use((config) => {
  const token = Cookies.get('kimy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    if (error.response?.status === 401) {
      if (isAuthDisabled) {
        // En modo demo, si recibimos 401, obtener token JWT de admin automáticamente y reintentar
        try {
          const res = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@kimy.edu',
            password: 'Kimy2026!',
          });
          if (res.data?.accessToken) {
            Cookies.set('kimy_token', res.data.accessToken, { expires: 7 });
            if (res.data.user) {
              Cookies.set('kimy_user', JSON.stringify(res.data.user), { expires: 7 });
            }
            if (error.config) {
              error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
              return axios.request(error.config);
            }
          }
        } catch {
          // Fallback si la API offline
        }
      } else {
        Cookies.remove('kimy_token');
        Cookies.remove('kimy_user');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
