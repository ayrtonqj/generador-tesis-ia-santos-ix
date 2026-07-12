import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import LoginScreen from '@/screens/auth/LoginScreen';
import TwoFactorScreen from '@/screens/auth/TwoFactorScreen';
import BottomTabNavigator from './BottomTabNavigator';
import FindingDetailScreen from '@/screens/reviews/FindingDetailScreen';
import FindingItemDetailScreen from '@/screens/reviews/FindingItemDetailScreen';
import type { AIFinding } from '@/hooks/useFindings';

export type AppStackParamList = {
  Tabs: undefined;
  FindingDetail: { advanceId: string };
  FindingItemDetail: { finding: AIFinding };
};

export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: { tempToken: string; email: string };
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="TwoFactor" component={TwoFactorScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F0F1A' },
      }}
    >
      <AppStack.Screen name="Tabs" component={BottomTabNavigator} />
      <AppStack.Screen
        name="FindingDetail"
        component={FindingDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <AppStack.Screen
        name="FindingItemDetail"
        component={FindingItemDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { token } = useAuthStore();
  return token ? <AppNavigator /> : <AuthNavigator />;
}
