import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const ROLE_LABELS: Record<string, string> = {
    STUDENT: '🎓 Estudiante',
    ADVISOR: '👨‍🏫 Asesor',
    COORDINATOR: '🏫 Coordinador',
    ADMIN: '⚙️ Administrador',
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userRole}>{ROLE_LABELS[user?.role ?? 'STUDENT']}</Text>
      </View>

      <View style={styles.infoSection}>
        <InfoRow icon="📧" label="Correo electrónico" value={user?.email ?? '—'} />
        <InfoRow icon="🎓" label="Rol" value={ROLE_LABELS[user?.role ?? 'STUDENT']} />
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionLabel}>Información</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Para actualizar tu perfil, contraseña o configuración de notificaciones,
            accede al portal web de KIMY.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>KIMY v1.0.0 · Sistema de Revisión de Tesis</Text>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  userRole: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  infoSection: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoIcon: { fontSize: 20, marginRight: Spacing.md },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  actionsSection: { marginHorizontal: Spacing.md, marginBottom: Spacing.md },
  sectionLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  logoutBtn: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.criticalBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  logoutText: { color: Colors.critical, fontSize: 15, fontWeight: '700' },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: Spacing.xxl,
  },
});
