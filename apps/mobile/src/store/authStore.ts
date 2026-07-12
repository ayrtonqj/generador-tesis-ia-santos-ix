import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADVISOR' | 'COORDINATOR' | 'ADMIN';
  avatarUrl?: string;
  programId?: string;
  advisorId?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

const TOKEN_KEY = 'kimy_auth_token';
const USER_KEY = 'kimy_auth_user';

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  isLoading: true,

  login: async (token: string, user: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user, isLoading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson) as AuthUser;
        set({ token, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
