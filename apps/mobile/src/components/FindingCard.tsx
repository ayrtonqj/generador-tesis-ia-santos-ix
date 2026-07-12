import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { SeverityBadge } from './SeverityBadge';
import type { AIFinding } from '@/hooks/useFindings';

interface FindingCardProps {
  finding: AIFinding;
  onPress?: () => void;
  compact?: boolean;
}

export function FindingCard({ finding, onPress, compact = false }: FindingCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SeverityBadge severity={finding.severity} size={compact ? 'sm' : 'md'} />
          {finding.pageRef && (
            <Text style={styles.pageRef}>Pág. {finding.pageRef}</Text>
          )}
        </View>
        {finding.humanAction && (
          <Text style={[styles.humanAction, humanActionStyle(finding.humanAction)]}>
            {finding.humanAction === 'ACCEPTED' ? '✓ Aceptado' :
             finding.humanAction === 'MODIFIED' ? '✎ Modificado' : '✗ Rechazado'}
          </Text>
        )}
      </View>

      <Text style={styles.section}>{finding.sectionRef}</Text>
      <Text style={styles.description} numberOfLines={compact ? 2 : 4}>
        {finding.description}
      </Text>

      {!compact && (
        <View style={styles.footer}>
          <Text style={styles.hint}>Toca para ver instrucciones de corrección →</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function humanActionStyle(action: string) {
  if (action === 'ACCEPTED') return { color: Colors.approved };
  if (action === 'REJECTED') return { color: Colors.rejected };
  return { color: Colors.minor };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pageRef: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  humanAction: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
