import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notificationsApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

// Configurar comportamiento de notificaciones en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { token: authToken } = useAuthStore();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!authToken) return;

    registerForPushNotifications();

    // Listener: notificación recibida mientras la app está abierta
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
        console.log('📱 Notificación recibida:', notification.request.content);
      });

    // Listener: usuario toca la notificación
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as {
          advanceId?: string;
          type?: string;
        };
        console.log('🔔 Notificación tocada:', data);
        // La navegación se maneja en el RootNavigator vía Linking
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authToken]);

  return {};
}

async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('Las push notifications requieren un dispositivo físico.');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permisos de notificación denegados.');
    return;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Advertencia: No se encontró el projectId de EAS en app.json.');
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const pushToken = tokenData.data;

    await notificationsApi.registerToken(
      pushToken,
      Platform.OS, // 'ios' | 'android'
    );

    console.log('✅ Push token registrado:', pushToken);
  } catch (error) {
    console.error('Error registrando push token:', error);
  }

  // Configurar canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'KIMY',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }
}
