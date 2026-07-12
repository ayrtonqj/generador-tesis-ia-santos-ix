import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useMutation } from '@tanstack/react-query';

export function useAuth() {
  const { user, token, isLoading, login, logout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const { data } = await authApi.login(email, password);
      return data as { accessToken?: string; user?: any; requires2fa?: boolean; tempToken?: string };
    },
    onSuccess: async (data) => {
      if (data.accessToken && data.user) {
        await login(data.accessToken, data.user);
      }
    },
  });

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    loginMutation,
    logout,
  };
}
