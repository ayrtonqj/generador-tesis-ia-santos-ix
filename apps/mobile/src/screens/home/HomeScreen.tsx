import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useAdvances } from '@/hooks/useAdvances';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: Colors.pending },
  AI_PROCESSING: { label: 'Analizando IA...', color: Colors.aiProcessing },
  AI_COMPLETE: { label: 'Listo para revisión', color: Colors.aiComplete },
  HUMAN_REVIEW: { label: 'En revisión', color: Colors.humanReview },
  OBSERVED: { label: 'Observado', color: Colors.observed },
  APPROVED: { label: 'Aprobado ✓', color: Colors.approved },
  REJECTED: { label: 'Rechazado', color: Colors.rejected },
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { data: advances, isLoading, refetch, isRefetching } = useAdvances();

  const latestAdvance = advances?.[0];
  const pendingCount = advances?.filter(
    (a) => a.status === 'AI_COMPLETE' || a.status === 'OBSERVED',
  ).length ?? 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#1A1A2E', '#0F0F1A']}
        style={styles.header}
      >
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0]} 👋</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user?.name?.[0]?.toUpperCase() ?? 'E'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderColor: Colors.primary }]}>
            <Text style={styles.kpiValue}>
              {latestAdvance?.aiAnalysis?.gradeConverted?.toFixed(1) ?? '—'}
            </Text>
            <Text style={styles.kpiLabel}>Última nota</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: Colors.major }]}>
            <Text style={[styles.kpiValue, { color: Colors.major }]}>
              {pendingCount}
            </Text>
            <Text style={styles.kpiLabel}>Con observaciones</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: Colors.approved }]}>
            <Text style={[styles.kpiValue, { color: Colors.approved }]}>
              {advances?.filter((a) => a.status === 'APPROVED').length ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Aprobados</Text>
          </View>
        </View>

        {/* Último avance */}
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : latestAdvance ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Último Avance</Text>
            <View style={styles.advanceCard}>
              <View style={styles.advanceHeader}>
                <Text style={styles.advanceTitle} numberOfLines={2}>
                  {latestAdvance.title}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        STATUS_LABELS[latestAdvance.status]?.color ?? Colors.pending,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.statusText,
                  { color: STATUS_LABELS[latestAdvance.status]?.color },
                ]}
              >
                {STATUS_LABELS[latestAdvance.status]?.label}
              </Text>

              {latestAdvance.aiAnalysis && (
                <View style={styles.scoreBar}>
                  <View style={styles.scoreBarBg}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${latestAdvance.aiAnalysis.overallScore}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.scoreText}>
                    {latestAdvance.aiAnalysis.overallScore.toFixed(0)}% cumplimiento
                  </Text>
                </View>
              )}

              <Text style={styles.advanceMeta}>
                Versión {latestAdvance.version} · {latestAdvance.advanceType}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>Sin avances registrados</Text>
            <Text style={styles.emptyBody}>
              Sube tu primer avance desde el portal web de KIMY
            </Text>
          </View>
        )}

        {/* Avances con observaciones */}
        {pendingCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requieren atención</Text>
            {advances
              ?.filter((a) => a.status === 'OBSERVED' || a.status === 'AI_COMPLETE')
              .slice(0, 3)
              .map((a) => (
                <View key={a.id} style={styles.alertCard}>
                  <Text style={styles.alertTitle} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text style={[styles.alertStatus, { color: STATUS_LABELS[a.status]?.color }]}>
                    {STATUS_LABELS[a.status]?.label}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.xl,
  },
  greeting: { fontSize: 14, color: Colors.textMuted },
  userName: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  kpiLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  advanceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  advanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  advanceTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs },
  scoreBar: { marginTop: Spacing.md },
  scoreBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  scoreText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  advanceMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  alertCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  alertStatus: { fontSize: 11, fontWeight: '600' },
});
