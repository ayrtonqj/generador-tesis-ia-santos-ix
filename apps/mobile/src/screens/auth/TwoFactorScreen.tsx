import React, { useState, useRef } from 'react';
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
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '@/navigation/RootNavigator';

type TwoFactorRouteProp = RouteProp<AuthStackParamList, 'TwoFactor'>;

export default function TwoFactorScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const route = useRoute<TwoFactorRouteProp>();
  const navigation = useNavigation();
  const { login } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const tempToken = route.params.tempToken;
  const email = route.params.email;

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert('Código incompleto', 'Ingresa los 6 dígitos del código de autenticación.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/2fa/authenticate', {
        tempToken,
        code,
      });
      await login(data.accessToken, data.user);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Código inválido. Intenta de nuevo.';
      Alert.alert('Error de verificación', message);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
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
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={styles.appName}>KIMY</Text>
          <Text style={styles.tagline}>Autenticación en Dos Pasos</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Verificación 2FA</Text>
          <Text style={styles.subtitle}>
            Ingresa el código de 6 dígitos desde tu app de autenticación ({email})
          </Text>

          <View style={styles.codeContainer}>
            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              placeholder="••••••"
              placeholderTextColor={Colors.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#6C63FF', '#8B83FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Verificar código</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>Volver al login</Text>
          </TouchableOpacity>
        </View>
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
  title: {
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
  codeContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  codeInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  backBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  backText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
