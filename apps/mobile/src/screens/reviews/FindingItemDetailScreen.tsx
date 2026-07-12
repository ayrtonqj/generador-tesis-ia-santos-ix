import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { SeverityBadge } from '@/components/SeverityBadge';
import type { AppStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<AppStackParamList, 'FindingItemDetail'>;

export default function FindingItemDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { finding } = route.params;

  const Section = ({ icon, title, content }: { icon: string; title: string; content: string }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Badge + Sección */}
        <View style={styles.topRow}>
          <SeverityBadge severity={finding.severity} />
          {finding.pageRef && (
            <Text style={styles.pageRef}>Página {finding.pageRef}</Text>
          )}
        </View>

        <Text style={styles.sectionRef}>{finding.sectionRef}</Text>

        {/* Contenido */}
        <Section icon="🔍" title="Descripción del hallazgo" content={finding.description} />
        <Section icon="📝" title="Instrucciones de corrección" content={finding.correctionSteps} />
        <Section icon="✨" title="Ejemplo de mejora" content={finding.exampleImprovement} />
        <Section icon="💡" title="Recomendación académica" content={finding.recommendation} />

        {/* Estado de revisión humana */}
        {finding.humanAction && (
          <View style={styles.humanReview}>
            <Text style={styles.humanReviewTitle}>Revisión del asesor</Text>
            <Text
              style={[
                styles.humanReviewAction,
                {
                  color:
                    finding.humanAction === 'ACCEPTED'
                      ? Colors.approved
                      : finding.humanAction === 'REJECTED'
                      ? Colors.rejected
                      : Colors.minor,
                },
              ]}
            >
              {finding.humanAction === 'ACCEPTED'
                ? '✓ Hallazgo aceptado por el asesor'
                : finding.humanAction === 'MODIFIED'
                ? '✎ Hallazgo modificado por el asesor'
                : '✗ Hallazgo descartado por el asesor'}
            </Text>
            {finding.humanComment && (
              <Text style={styles.humanComment}>{finding.humanComment}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: 52,
    paddingBottom: Spacing.sm,
  },
  backText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pageRef: {
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  sectionRef: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  humanReview: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderActive,
  },
  humanReviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  humanReviewAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  humanComment: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
