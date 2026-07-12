import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useNotifications } from '@/hooks/useNotifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  const { loadFromStorage } = useAuthStore();
  useNotifications();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
