import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/colors';
import HomeScreen from '@/screens/home/HomeScreen';
import ReviewsListScreen from '@/screens/reviews/ReviewsListScreen';
import GradeHistoryScreen from '@/screens/history/GradeHistoryScreen';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Text style={styles.iconEmoji}>{icon}</Text>
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="🏠" label="Inicio" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Reviews"
        component={ReviewsListScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="📋" label="Revisiones" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={GradeHistoryScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="📈" label="Historial" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="📄" label="Reportes" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="👤" label="Perfil" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1A1A2E',
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 10,
    paddingTop: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    minWidth: 56,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  iconEmoji: {
    fontSize: 20,
  },
  iconLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  iconLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
