import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useFindings, type FindingSeverity, type AIFinding } from '@/hooks/useFindings';
import { useAdvanceById } from '@/hooks/useAdvances';
import { FindingCard } from '@/components/FindingCard';
import { ScoreRadar } from '@/components/ScoreRadar';
import type { AppStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<AppStackParamList, 'FindingDetail'>;
type Nav = NativeStackNavigationProp<AppStackParamList>;

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  CRITICAL: 0,
  MAJOR: 1,
  MINOR: 2,
  SUGGESTION: 3,
};

const TABS = ['Hallazgos IA', 'Resumen', 'Puntuación'];

export default function FindingDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { advanceId } = route.params;
  const { data: analysis, isLoading } = useFindings(advanceId);
  const { data: advance } = useAdvanceById(advanceId);
  const [activeTab, setActiveTab] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');

  const sortedFindings = analysis?.findings
    ?.filter((f) => severityFilter === 'ALL' || f.severity === severityFilter)
    ?.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando hallazgos...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyIcon}>🤖</Text>
        <Text style={styles.emptyTitle}>Sin análisis disponible</Text>
        <Text style={styles.emptyBody}>
          El análisis de IA aún no se ha completado para este avance.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {advance?.title ?? 'Detalle de avance'}
        </Text>
      </View>

      {/* Score Summary */}
      <View style={styles.scoreSummary}>
        <View style={styles.scoreMain}>
          <Text style={styles.scorePercent}>
            {analysis.overallScore.toFixed(0)}%
          </Text>
          <Text style={styles.scoreLabel}>Cumplimiento</Text>
          <Text style={styles.scoreGrade}>
            Nota: {analysis.gradeConverted.toFixed(2)} / 20
          </Text>
        </View>
        <View style={styles.scoreDimensions}>
          {[
            { label: 'Estructura', value: analysis.structureScore },
            { label: 'Contenido', value: analysis.contentScore },
            { label: 'Forma', value: analysis.formScore },
            { label: 'Originalidad', value: analysis.originalityScore },
          ].map((dim) => (
            <View key={dim.label} style={styles.dim}>
              <Text style={styles.dimValue}>{dim.value.toFixed(0)}%</Text>
              <Text style={styles.dimLabel}>{dim.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          {/* Severity filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.severityFilters}
          >
            {(['ALL', 'CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.severityChip,
                  severityFilter === s && styles.severityChipActive,
                ]}
                onPress={() => setSeverityFilter(s)}
              >
                <Text
                  style={[
                    styles.severityChipText,
                    severityFilter === s && styles.severityChipTextActive,
                  ]}
                >
                  {s === 'ALL' ? `Todos (${analysis.findings.length})` :
                   s === 'CRITICAL' ? `🔴 Críticos` :
                   s === 'MAJOR' ? `🟠 Mayores` :
                   s === 'MINOR' ? `🟡 Menores` : `🟢 Sugerencias`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={sortedFindings}
            keyExtractor={(item: AIFinding) => item.id}
            renderItem={({ item }: { item: AIFinding }) => (
              <FindingCard
                finding={item}
                onPress={() => navigation.navigate('FindingItemDetail', { finding: item })}
              />
            )}
            contentContainerStyle={styles.findingsList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay hallazgos en esta categoría.</Text>
            }
          />
        </>
      )}

      {activeTab === 1 && (
        <ScrollView contentContainerStyle={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Resumen ejecutivo</Text>
          <Text style={styles.summaryText}>{analysis.executiveSummary}</Text>
          <Text style={styles.modelBadge}>
            Modelo: {analysis.modelUsed} · {(analysis.processingMs / 1000).toFixed(1)}s
          </Text>
        </ScrollView>
      )}

      {activeTab === 2 && (
        <ScrollView contentContainerStyle={styles.radarContainer}>
          <Text style={styles.radarTitle}>Dimensiones de evaluación</Text>
          <ScoreRadar
            scores={{
              estructura: analysis.structureScore,
              contenido: analysis.contentScore,
              forma: analysis.formScore,
              originalidad: analysis.originalityScore,
            }}
            size={240}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: { color: Colors.textMuted, fontSize: 14 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: 52,
    paddingBottom: Spacing.sm,
  },
  backBtn: { marginBottom: Spacing.xs },
  backText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scoreSummary: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  scoreMain: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    minWidth: 80,
  },
  scorePercent: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.primary,
  },
  scoreLabel: { fontSize: 11, color: Colors.textMuted },
  scoreGrade: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
  scoreDimensions: {
    flex: 1,
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dim: {
    width: '45%',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
  },
  dimValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  dimLabel: { fontSize: 10, color: Colors.textMuted },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.sm },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, color: Colors.textMuted },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  severityFilters: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  severityChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  severityChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  severityChipText: { fontSize: 12, color: Colors.textMuted },
  severityChipTextActive: { color: '#fff', fontWeight: '600' },
  findingsList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.lg },
  summaryContainer: { padding: Spacing.lg },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  modelBadge: {
    marginTop: Spacing.lg,
    fontSize: 11,
    color: Colors.textMuted,
  },
  radarContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  radarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
});
