import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '@/constants/colors';
import type { FindingSeverity } from '@/hooks/useFindings';

interface SeverityBadgeProps {
  severity: FindingSeverity;
  size?: 'sm' | 'md';
}

const SEVERITY_CONFIG: Record<
  FindingSeverity,
  { label: string; color: string; bg: string; icon: string }
> = {
  CRITICAL: { label: 'Crítico', color: Colors.critical, bg: Colors.criticalBg, icon: '🔴' },
  MAJOR: { label: 'Mayor', color: Colors.major, bg: Colors.majorBg, icon: '🟠' },
  MINOR: { label: 'Menor', color: Colors.minor, bg: Colors.minorBg, icon: '🟡' },
  SUGGESTION: { label: 'Sugerencia', color: Colors.suggestion, bg: Colors.suggestionBg, icon: '🟢' },
};

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.color },
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.text, { color: config.color }, isSmall && styles.textSmall]}>
        {isSmall ? config.icon : `${config.icon} ${config.label}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
});
