import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAdvances, type Advance } from '@/hooks/useAdvances';
import type { AppStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendiente', color: Colors.pending, icon: '⏳' },
  AI_PROCESSING: { label: 'Analizando IA', color: Colors.aiProcessing, icon: '🤖' },
  AI_COMPLETE: { label: 'Lista para revisar', color: Colors.aiComplete, icon: '✨' },
  HUMAN_REVIEW: { label: 'En revisión', color: Colors.humanReview, icon: '👁️' },
  OBSERVED: { label: 'Observado', color: Colors.observed, icon: '⚠️' },
  APPROVED: { label: 'Aprobado', color: Colors.approved, icon: '✅' },
  REJECTED: { label: 'Rechazado', color: Colors.rejected, icon: '❌' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'AI_COMPLETE', label: 'Con IA' },
  { key: 'OBSERVED', label: 'Observados' },
  { key: 'APPROVED', label: 'Aprobados' },
];

export default function ReviewsListScreen() {
  const navigation = useNavigation<Nav>();
  const { data: advances, isLoading, refetch, isRefetching } = useAdvances();
  const [filter, setFilter] = useState('all');

  const filtered = advances?.filter((a) =>
    filter === 'all' ? true : a.status === filter,
  );

  const renderItem = ({ item }: { item: Advance }) => {
    const conf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['PENDING'];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('FindingDetail', { advanceId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${conf.color}22` }]}>
            <Text style={[styles.statusText, { color: conf.color }]}>
              {conf.icon} {conf.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            {item.advanceType} · v{item.version}
          </Text>
          {item.aiAnalysis && (
            <Text style={styles.scoreText}>
              {item.aiAnalysis.overallScore.toFixed(0)}% · {item.aiAnalysis.gradeConverted.toFixed(1)} pts
            </Text>
          )}
        </View>

        {item.aiAnalysis && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${item.aiAnalysis.overallScore}%`,
                  backgroundColor: item.aiAnalysis.overallScore >= 70
                    ? Colors.approved
                    : item.aiAnalysis.overallScore >= 50
                    ? Colors.major
                    : Colors.critical,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Revisiones</Text>
        <Text style={styles.headerCount}>{advances?.length ?? 0} avances</Text>
      </View>

      {/* Filtros */}
      <FlatList
        data={FILTER_OPTIONS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: { key: string; label: string }) => item.key}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }: { item: { key: string; label: string } }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text
              style={[styles.filterText, filter === item.key && styles.filterTextActive]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Lista */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: Advance) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>Sin avances en esta categoría</Text>
            </View>
          }
        />
      )}
    </View>
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
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerCount: { fontSize: 13, color: Colors.textMuted },
  filterList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, color: Colors.textMuted },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  metaText: { fontSize: 12, color: Colors.textMuted },
  scoreText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
