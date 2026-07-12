import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAdvances } from '@/hooks/useAdvances';

const screenWidth = Dimensions.get('window').width;

export default function GradeHistoryScreen() {
  const { data: advances, isLoading } = useAdvances();

  const withGrades = advances
    ?.filter((a) => a.aiAnalysis)
    ?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    ?? [];

  const chartData = {
    labels: withGrades.map((_, i) => `v${i + 1}`),
    datasets: [
      {
        data: withGrades.map((a) => a.aiAnalysis!.gradeConverted),
        color: () => Colors.primary,
        strokeWidth: 2,
      },
      {
        data: withGrades.map((a) => a.aiAnalysis!.overallScore / 5), // normalizar sobre 20
        color: () => Colors.suggestion,
        strokeWidth: 1.5,
      },
    ],
    legend: ['Nota IA (0-20)', 'Cumplimiento (%)'],
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (withGrades.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>Sin historial disponible</Text>
        <Text style={styles.emptyBody}>
          Tu historial de notas aparecerá aquí una vez que se completen los análisis de IA.
        </Text>
      </View>
    );
  }

  const latestGrade = withGrades[withGrades.length - 1]?.aiAnalysis?.gradeConverted ?? 0;
  const firstGrade = withGrades[0]?.aiAnalysis?.gradeConverted ?? 0;
  const trend = latestGrade - firstGrade;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Evolución de Notas</Text>
        <Text style={styles.headerSub}>{withGrades.length} versiones evaluadas</Text>
      </View>

      {/* Trend cards */}
      <View style={styles.trendRow}>
        <View style={styles.trendCard}>
          <Text style={styles.trendValue}>{latestGrade.toFixed(2)}</Text>
          <Text style={styles.trendLabel}>Nota actual</Text>
        </View>
        <View style={styles.trendCard}>
          <Text
            style={[
              styles.trendValue,
              { color: trend >= 0 ? Colors.approved : Colors.rejected },
            ]}
          >
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)}
          </Text>
          <Text style={styles.trendLabel}>Progreso total</Text>
        </View>
        <View style={styles.trendCard}>
          <Text style={styles.trendValue}>{withGrades.length}</Text>
          <Text style={styles.trendLabel}>Versiones</Text>
        </View>
      </View>

      {/* Gráfico */}
      {withGrades.length >= 2 && (
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={screenWidth - Spacing.md * 2}
            height={220}
            chartConfig={{
              backgroundColor: Colors.bgCard,
              backgroundGradientFrom: Colors.bgCard,
              backgroundGradientTo: Colors.bgCard,
              decimalPlaces: 1,
              color: () => Colors.primary,
              labelColor: () => Colors.textMuted,
              style: { borderRadius: BorderRadius.lg },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: Colors.primary,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Tabla */}
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>Detalle por versión</Text>
        {withGrades.map((a, i) => (
          <View key={a.id} style={styles.tableRow}>
            <Text style={styles.tableVersion}>v{i + 1}</Text>
            <Text style={styles.tableType} numberOfLines={1}>
              {a.advanceType}
            </Text>
            <Text style={styles.tableGrade}>
              {a.aiAnalysis!.gradeConverted.toFixed(2)}
            </Text>
            <Text style={styles.tableScore}>
              {a.aiAnalysis!.overallScore.toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textMuted },
  trendRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  trendCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  trendLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  chartContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  chart: { borderRadius: BorderRadius.lg },
  tableContainer: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tableVersion: { width: 30, fontSize: 12, color: Colors.primary, fontWeight: '700' },
  tableType: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  tableGrade: { width: 50, fontSize: 12, color: Colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  tableScore: { width: 45, fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
});
