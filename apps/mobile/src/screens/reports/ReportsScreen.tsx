import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, BorderRadius } from '@/constants/colors';
import { useAdvances, type Advance } from '@/hooks/useAdvances';
import { reportsApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function ReportsScreen() {
  const { data: advances, isLoading } = useAdvances();
  const { token } = useAuthStore();
  const [downloading, setDownloading] = useState<string | null>(null);

  const approvedOrObserved = advances?.filter(
    (a) => ['APPROVED', 'OBSERVED', 'AI_COMPLETE', 'HUMAN_REVIEW', 'REJECTED'].includes(a.status),
  );

  const downloadReport = async (advanceId: string, title: string) => {
    setDownloading(advanceId);
    try {
      const url = reportsApi.downloadUrl(advanceId);
      const fileName = `KIMY_${title.replace(/\s+/g, '_').slice(0, 30)}.pdf`;
      const fileUri = `${documentDirectory}${fileName}`;

      const result = await downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Reporte: ${title}`,
          });
        } else {
          Alert.alert('Descargado', `El reporte fue guardado en: ${result.uri}`);
        }
      } else {
        Alert.alert('Error', 'No se pudo descargar el reporte. Intenta más tarde.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reportes</Text>
        <Text style={styles.headerSub}>
          Descarga tus actas de revisión en PDF
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={approvedOrObserved}
          keyExtractor={(item: Advance) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Sin reportes disponibles</Text>
              <Text style={styles.emptyBody}>
                Los reportes estarán disponibles una vez que un asesor complete la revisión.
              </Text>
            </View>
          }
          renderItem={({ item }: { item: Advance }) => (
            <View style={styles.reportCard}>
              <View style={styles.reportIcon}>
                <Text style={styles.reportIconText}>📄</Text>
              </View>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.reportMeta}>
                  {item.advanceType} · v{item.version}
                </Text>
                {item.aiAnalysis && (
                  <Text style={styles.reportScore}>
                    {item.aiAnalysis.gradeConverted.toFixed(2)} / 20 pts
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  downloading === item.id && styles.downloadBtnDisabled,
                ]}
                onPress={() => downloadReport(item.id, item.title)}
                disabled={!!downloading}
              >
                {downloading === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.downloadBtnText}>↓ PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportIcon: {
    width: 44,
    height: 44,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  reportIconText: { fontSize: 22 },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  reportMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  reportScore: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  downloadBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
