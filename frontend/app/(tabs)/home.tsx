import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator, LayoutAnimation, Platform, UIManager
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pill, Camera, MessageCircle, MapPin, Flame, CheckCircle2, Clock, XCircle, Plus, AlertTriangle, Search, Bell } from 'lucide-react-native';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { t } from '../../src/i18n';
import AnimatedPressable from '../../src/components/AnimatedPressable';
import { hapticSuccess, hapticMedium } from '../../src/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ScheduleItem = {
  medication_id: string;
  medication_name: string;
  dosage: string;
  notes: string;
  scheduled_time: string;
  scheduled_date: string;
  status: 'pending' | 'taken' | 'skipped';
};

export default function HomeScreen() {
  const { user, language } = useAuth();
  const L = t(language);
  const router = useRouter();
  const queryClient = useQueryClient();

  const fetchDashboard = async () => {
    const [s, st, m] = await Promise.all([
      api.get('/schedule/today'),
      api.get('/stats/summary'),
      api.get('/missed-doses', { params: { days: 2 } }),
    ]);
    return {
      schedule: s.data.items as ScheduleItem[],
      stats: st.data,
      missed: m.data.missed || [],
    };
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const schedule = data?.schedule || [];
  const stats = data?.stats || null;
  const missed = data?.missed || [];

  useEffect(() => {
    if (missed.length > 0) {
      checkAndShowMissedAlert();
    }
  }, [missed]);

  const checkAndShowMissedAlert = async () => {
    try {
      const lastAlerted = await AsyncStorage.getItem('last_alerted_missed');
      const currentMissedKey = missed.map(m => `${m.medication_id}-${m.scheduled_date}-${m.scheduled_time}`).join(',');
      
      if (lastAlerted !== currentMissedKey) {
        Alert.alert(
          language === 'tr' ? 'Hatırlatma' : 'Reminder',
          language === 'tr' 
            ? `Saati geçmiş ${missed.length} adet ilacınız var! Lütfen aşağıdan kontrol edip ilaçlarınızı alın.` 
            : `You have ${missed.length} overdue medications! Please check below and take your medications.`,
          [{ text: language === 'tr' ? 'Tamam' : 'OK', onPress: () => AsyncStorage.setItem('last_alerted_missed', currentMissedKey) }]
        );
      }
    } catch (e) {
      // ignore
    }
  };

  const onRefresh = () => { refetch(); };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return L.goodMorning;
    if (h < 18) return L.goodAfternoon;
    return L.goodEvening;
  };

  const markDose = async (item: ScheduleItem, status: 'taken' | 'skipped') => {
    try {
      if (status === 'taken') hapticSuccess();
      else hapticMedium();
      
      await api.post('/dose-logs', {
        medication_id: item.medication_id,
        scheduled_date: item.scheduled_date,
        scheduled_time: item.scheduled_time,
        status,
      });
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      Alert.alert(L.error, e?.response?.data?.detail || 'Action failed');
    }
  };

  const isUpcoming = (time: string) => {
    const now = new Date();
    const [h, m] = time.split(':').map(Number);
    const dose = new Date();
    dose.setHours(h, m, 0, 0);
    const diff = (dose.getTime() - now.getTime()) / 60000;
    return diff >= 0 && diff <= 120;
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text testID="user-greeting" style={styles.userName}>{user?.name} 👋</Text>
          </View>
          <View style={styles.headerRight}>
            <AnimatedPressable style={styles.headerBtn}>
              <Search size={20} color={colors.textMain} strokeWidth={2.5} />
            </AnimatedPressable>
            <AnimatedPressable style={styles.headerBtn}>
              <Bell size={20} color={colors.textMain} strokeWidth={2.5} />
            </AnimatedPressable>
          </View>
        </View>

        {/* Streak */}
        {stats && stats.streak_days > 0 && (
          <View testID="streak-card" style={styles.streakCard}>
            <View style={styles.streakIcon}>
              <Flame size={28} color={colors.accent} fill={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakNum}>{stats.streak_days} {L.streakDays}</Text>
              <Text style={styles.streakSub}>{stats.streak_days} {L.streakMessage}</Text>
            </View>
          </View>
        )}

        {/* Missed doses warning */}
        {missed.length > 0 && (
          <View testID="missed-warning" style={styles.missedCard}>
            <View style={styles.missedIcon}>
              <AlertTriangle size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.missedTitle}>
                {missed.length} {L.missedDoses}
              </Text>
              <Text style={styles.missedSub}>{L.missedDosesSubtitle}</Text>
              {missed.slice(0, 3).map((m, i) => (
                <Text key={i} style={styles.missedItem}>• {m.medication_name} · {m.scheduled_time}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View testID="summary-active" style={[styles.summaryCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.summaryNum}>{stats?.active_medications ?? 0}</Text>
            <Text style={styles.summaryLabel}>{L.activeMeds}</Text>
          </View>
          <View testID="summary-taken" style={[styles.summaryCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.summaryNum}>{stats?.today_taken ?? 0}</Text>
            <Text style={styles.summaryLabel}>{L.takenToday}</Text>
          </View>
          <View testID="summary-remaining" style={[styles.summaryCard, { borderLeftColor: colors.warning }]}>
            <Text style={styles.summaryNum}>{stats?.today_remaining ?? 0}</Text>
            <Text style={styles.summaryLabel}>{L.remaining}</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>{L.quickActions}</Text>
        <View style={styles.actionsGrid}>
          <AnimatedPressable testID="action-add-med" style={styles.actionCard} onPress={() => router.push('/medication-form')}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5FA' }]}><Plus size={24} color={colors.primary} /></View>
            <Text style={styles.actionText}>{L.addMedication}</Text>
          </AnimatedPressable>
          <AnimatedPressable testID="action-scan" style={styles.actionCard} onPress={() => router.push('/scan')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FCEAEA' }]}><Camera size={24} color={colors.error} /></View>
            <Text style={styles.actionText}>{L.scanMedication}</Text>
          </AnimatedPressable>
          <AnimatedPressable testID="action-chat" style={styles.actionCard} onPress={() => router.push('/(tabs)/chat')}>
            <View style={[styles.actionIcon, { backgroundColor: '#EDF7E8' }]}><MessageCircle size={24} color={colors.success} /></View>
            <Text style={styles.actionText}>{L.openChat}</Text>
          </AnimatedPressable>
          <AnimatedPressable testID="action-pharmacy" style={styles.actionCard} onPress={() => router.push('/(tabs)/pharmacy')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF6E1' }]}><MapPin size={24} color={colors.warning} /></View>
            <Text style={styles.actionText}>{L.findPharmacy}</Text>
          </AnimatedPressable>
        </View>

        {/* Today schedule */}
        <Text style={styles.sectionTitle}>{L.todaySchedule}</Text>
        {schedule.length === 0 ? (
          <View testID="empty-today" style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Pill size={32} color={colors.primary} /></View>
            <Text style={styles.emptyText}>{L.noMedsToday}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {schedule.map((item, idx) => {
              const upcoming = item.status === 'pending' && isUpcoming(item.scheduled_time);
              return (
                <View
                  key={`${item.medication_id}-${item.scheduled_time}`}
                  testID={`dose-item-${idx}`}
                  style={[styles.doseCard, upcoming && styles.doseCardUpcoming]}
                >
                  <View style={styles.timeBubble}>
                    <Text style={styles.timeText}>{item.scheduled_time}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.doseName}>{item.medication_name}</Text>
                    <Text style={styles.doseDosage}>{item.dosage}</Text>
                    {!!item.notes && <Text style={styles.doseNotes}>{item.notes}</Text>}
                  </View>
                  {item.status === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <AnimatedPressable
                        testID={`mark-taken-${idx}`}
                        style={[styles.smallBtn, { backgroundColor: colors.success }]}
                        onPress={() => markDose(item, 'taken')}
                        scaleTo={0.8}
                      >
                        <CheckCircle2 size={16} color="#fff" />
                      </AnimatedPressable>
                      <AnimatedPressable
                        testID={`mark-skipped-${idx}`}
                        style={[styles.smallBtn, { backgroundColor: colors.surfaceElevated }]}
                        onPress={() => markDose(item, 'skipped')}
                        scaleTo={0.8}
                      >
                        <XCircle size={16} color={colors.textMuted} />
                      </AnimatedPressable>
                    </View>
                  ) : item.status === 'taken' ? (
                    <View style={[styles.statusPill, { backgroundColor: '#EDF7E8' }]}>
                      <CheckCircle2 size={14} color={colors.success} />
                      <Text style={[styles.statusText, { color: colors.success }]}>{L.taken}</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: '#FCEAEA' }]}>
                      <XCircle size={14} color={colors.error} />
                      <Text style={[styles.statusText, { color: colors.error }]}>{L.skipped}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  scroll: { padding: spacing.xxl, paddingBottom: 120 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', gap: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
  userName: { fontSize: 32, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5, marginTop: 4 },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg,
    ...shadows.card,
  },
  streakIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1EAFD', justifyContent: 'center', alignItems: 'center' },
  streakNum: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  streakSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  missedCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FCEAEA',
    borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg,
  },
  missedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8D5D5', justifyContent: 'center', alignItems: 'center' },
  missedTitle: { fontSize: 16, fontWeight: '800', color: colors.error },
  missedSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  missedItem: { fontSize: 14, color: colors.textMain, marginTop: 6, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.lg },
  summaryCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.md, borderLeftWidth: 4,
    borderLeftColor: colors.primary, // overridden inline
    ...shadows.card,
  },
  summaryNum: { fontSize: 24, fontWeight: '800', color: colors.textMain },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.textMain, marginTop: spacing.xl, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacing.lg },
  actionCard: {
    width: '48%', backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, alignItems: 'flex-start',
    ...shadows.card,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionText: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center',
    ...shadows.card,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  doseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.md,
    ...shadows.card,
  },
  doseCardUpcoming: { backgroundColor: '#E8F5FA' },
  timeBubble: {
    width: 64, paddingVertical: 10, borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated, alignItems: 'center',
  },
  timeText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  doseName: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  doseDosage: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  doseNotes: { fontSize: 13, color: colors.secondary, marginTop: 4, fontStyle: 'italic' },
  smallBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  statusText: { fontSize: 13, fontWeight: '800' },
});
