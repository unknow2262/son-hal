import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, ActivityIndicator, ScrollView, Dimensions, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pill, Plus, Trash2, Edit3, Clock, BarChart3 } from 'lucide-react-native';
import { BarChart } from 'react-native-chart-kit';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { t } from '../../src/i18n';
import { cancelMedicationReminders } from '../../src/services/notifications';
import AnimatedPressable from '../../src/components/AnimatedPressable';
import { hapticError, hapticLight } from '../../src/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Med = {
  id: string;
  name: string;
  dosage: string;
  frequency_per_day: number;
  times: string[];
  duration_days: number;
  notes: string;
  start_date: string;
  end_date: string;
};

const screenW = Dimensions.get('window').width;

export default function MedicationsScreen() {
  const { language } = useAuth();
  const L = t(language);
  const router = useRouter();
  const [tab, setTab] = useState<'list' | 'history'>('list');
  const queryClient = useQueryClient();

  const fetchMedications = async () => {
    const [m, a, pm] = await Promise.all([
      api.get('/medications'),
      api.get('/stats/adherence', { params: { days: 7 } }),
      api.get('/stats/medication-adherence'),
    ]);
    return {
      meds: m.data as Med[],
      adherence: a.data,
      perMed: pm.data.medications || [],
    };
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['medications'],
    queryFn: fetchMedications,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const meds = data?.meds || [];
  const adherence = data?.adherence || null;
  const perMed = data?.perMed || [];

  const onDelete = (m: Med) => {
    Alert.alert(L.delete, m.name, [
      { text: L.cancel, style: 'cancel' },
      {
        text: L.delete, style: 'destructive', onPress: async () => {
          try {
            hapticError();
            await api.delete(`/medications/${m.id}`);
            await cancelMedicationReminders(m.id).catch(() => {});
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            queryClient.invalidateQueries({ queryKey: ['medications'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          } catch (e: any) {
            Alert.alert(L.error, e?.response?.data?.detail || 'Failed');
          }
        }
      }
    ]);
  };

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{L.medications}</Text>
        <AnimatedPressable testID="add-med-button" style={styles.addBtn} onPress={() => router.push('/medication-form')}>
          <Plus size={18} color={colors.textMain} />
          <Text style={styles.addBtnText}>{L.addNew}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.tabRow}>
        <AnimatedPressable
          testID="tab-list"
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setTab('list'); hapticLight(); }}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>{L.medications}</Text>
        </AnimatedPressable>
        <AnimatedPressable
          testID="tab-history"
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setTab('history'); hapticLight(); }}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>{L.history}</Text>
        </AnimatedPressable>
      </View>

      {tab === 'list' ? (
        meds.length === 0 ? (
          <View testID="empty-meds" style={styles.empty}>
            <View style={styles.emptyIcon}><Pill size={36} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{L.noMeds}</Text>
            <AnimatedPressable testID="empty-add-button" style={styles.primaryBtn} onPress={() => router.push('/medication-form')}>
              <Text style={styles.primaryBtnText}>{L.addFirstMed}</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={meds}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
            renderItem={({ item, index }) => (
              <View testID={`med-card-${index}`} style={styles.medCard}>
                <View style={styles.medIcon}><Pill size={22} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{item.name}</Text>
                  <Text style={styles.medDosage}>{item.dosage} · {item.frequency_per_day}x/{language === 'tr' ? 'gün' : 'day'}</Text>
                  <View style={styles.timeChips}>
                    {item.times.map((t) => (
                      <View key={t} style={styles.timeChip}>
                        <Clock size={11} color={colors.primary} />
                        <Text style={styles.timeChipText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  {!!item.notes && <Text style={styles.medNotes}>{item.notes}</Text>}
                </View>
                <View style={{ gap: 6 }}>
                  <AnimatedPressable
                    testID={`med-edit-${index}`}
                    style={styles.iconBtn}
                    onPress={() => router.push({ pathname: '/medication-form', params: { id: item.id } })}
                    scaleTo={0.8}
                  >
                    <Edit3 size={16} color={colors.textMuted} />
                  </AnimatedPressable>
                  <AnimatedPressable testID={`med-delete-${index}`} style={styles.iconBtn} onPress={() => onDelete(item)} scaleTo={0.8}>
                    <Trash2 size={16} color={colors.accent} />
                  </AnimatedPressable>
                </View>
              </View>
            )}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 120 }}>
          {/* Weekly chart */}
          {adherence && adherence.days?.length > 0 && (
            <View testID="adherence-chart" style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <BarChart3 size={18} color={colors.primary} />
                <Text style={styles.chartTitle}>{L.weeklyAdherence}</Text>
              </View>
              <BarChart
                data={{
                  labels: adherence.days.map((d: any) => d.date.slice(5)),
                  datasets: [{ data: adherence.days.map((d: any) => d.rate) }],
                }}
                width={screenW - 80}
                height={200}
                yAxisSuffix="%"
                yAxisLabel=""
                fromZero
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (o = 1) => `rgba(74, 144, 217, ${o})`,
                  labelColor: () => colors.textMuted,
                  barPercentage: 0.6,
                }}
                style={{ marginVertical: 8, borderRadius: radius.md }}
              />
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{L.perMedAdherence}</Text>
          {perMed.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>{L.noMeds}</Text>
          ) : (
            perMed.map((p, i) => (
              <View key={p.medication_id} testID={`per-med-${i}`} style={styles.perMedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{p.name}</Text>
                  <Text style={styles.medDosage}>{p.dosage} · {p.taken}/{p.scheduled}</Text>
                </View>
                <View style={[styles.rateBadge, { backgroundColor: p.rate >= 80 ? '#EDF7E8' : p.rate >= 50 ? '#FEF6E1' : '#FCEAEA' }]}>
                  <Text style={[styles.rateText, { color: p.rate >= 80 ? colors.success : p.rate >= 50 ? colors.warning : colors.error }]}>
                    {p.rate}%
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  addBtnText: { color: colors.textMain, fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.xxl, backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textMain },
  medCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12, gap: spacing.md,
    ...shadows.card,
  },
  medIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5FA', justifyContent: 'center', alignItems: 'center' },
  medName: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  medDosage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#E8F5FA' },
  timeChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  medNotes: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.chatAi, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.lg, fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 24 },
  primaryBtnText: { color: colors.textMain, fontWeight: '800' },
  chartCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.card },
  chartTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginBottom: spacing.md },
  perMedCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.lg, marginBottom: 10,
    ...shadows.card,
  },
  rateBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  rateText: { fontWeight: '800', fontSize: 14 },
});
