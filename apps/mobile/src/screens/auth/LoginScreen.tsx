import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/RootNavigator';

type AuthNavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginMutation } = useAuth();
  const navigation = useNavigation<AuthNavProp>();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu email y contraseña.');
      return;
    }
    loginMutation.mutate(
      { email: email.trim().toLowerCase(), password },
      {
        onSuccess: (data) => {
          if (data.requires2fa && data.tempToken) {
            navigation.navigate('TwoFactor', {
              tempToken: data.tempToken,
              email: email.trim().toLowerCase(),
            });
          }
        },
        onError: (err: any) => {
          if (err?.response) {
            Alert.alert('Error de acceso', err.response.data?.message || 'Credenciales incorrectas.');
          } else if (err?.request) {
            Alert.alert(
              'Error de conexión',
              'No se pudo conectar al servidor.\nVerifica que el API esté corriendo.',
            );
          } else {
            Alert.alert('Error', 'Ocurrió un error inesperado.');
          }
        },
      },
    );
  };

  return (
    <LinearGradient
      colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={styles.appName}>KIMY</Text>
          <Text style={styles.tagline}>Sistema de Revisión de Tesis</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.welcome}>Iniciar sesión</Text>
          <Text style={styles.subtitle}>
            Accede con las mismas credenciales del portal web
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.edu"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loginMutation.isPending && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#6C63FF', '#8B83FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Ingresar</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          ¿Olvidaste tu contraseña? Visita el portal web
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  form: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  inputGroup: { marginBottom: Spacing.md },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btn: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.6 },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.lg,
  },
});
