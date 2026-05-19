import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, Linking, ActivityIndicator, Platform, Dimensions, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, Clock, Navigation, Map as MapIcon, List, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../src/components/MapWrapper';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { t } from '../../src/i18n';
import AnimatedPressable from '../../src/components/AnimatedPressable';

type Pharmacy = {
  id: string; name: string; address: string; phone: string;
  hours: string; on_call: boolean; lat: number; lon: number; distance_m: number;
};

const FILTER_OPTIONS = [500, 1000, 2000, 5000];

// Default Istanbul center for web preview / when permission denied
const DEFAULT_LOC = { lat: 41.0082, lon: 28.9784 };

export default function PharmacyScreen() {
  const { language } = useAuth();
  const L = t(language);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [tab, setTab] = useState<'all' | 'oncall'>('all');
  const [radiusM, setRadiusM] = useState(2000);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const mapRef = useRef<MapView>(null);

  const checkStatus = (p: Pharmacy) => {
    if (p.on_call) return 'on_call';
    try {
      const now = new Date();
      if (now.getDay() === 0) return 'closed'; // Sunday
      if (!p.hours || p.hours.indexOf('-') === -1) return 'open';
      const parts = p.hours.split('-');
      const [sh, sm] = parts[0].trim().split(':').map(Number);
      const [eh, em] = parts[1].trim().split(':').map(Number);
      if (isNaN(sh) || isNaN(eh)) return 'open';
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = sh * 60 + (sm || 0);
      const endMin = eh * 60 + (em || 0);
      if (currentMin >= startMin && currentMin <= endMin) return 'open';
      return 'closed';
    } catch {
      return 'closed';
    }
  };

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        return DEFAULT_LOC;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setCoords(c);
      setLocDenied(false);
      return c;
    } catch {
      setLocDenied(true);
      return DEFAULT_LOC;
    }
  };

  const { data: list = [], isLoading: loading, refetch, isRefetching } = useQuery({
    queryKey: ['pharmacies', tab, radiusM],
    queryFn: async () => {
      let c = coords;
      if (!c) {
        c = await fetchLocation();
      }
      const r = await api.get('/pharmacies/nearby', {
        params: { lat: c.lat, lon: c.lon, radius_m: radiusM, on_call_only: tab === 'oncall' },
      });
      return r.data.pharmacies as Pharmacy[];
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const onRefresh = () => refetch();

  const callPharmacy = (phone: string) => {
    if (!phone) return Alert.alert(L.error, 'Telefon numarası bulunamadı');
    const url = `tel:${phone.replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Alert.alert(L.error, 'Cannot open dialer'));
  };

  const openMap = (p: Pharmacy) => {
    if (!p.lat || !p.lon) return Alert.alert(L.error, 'Konum bilgisi bulunamadı');
    const url = Platform.select({
      ios: `maps:0,0?q=${p.name}@${p.lat},${p.lon}`,
      android: `geo:0,0?q=${p.lat},${p.lon}(${p.name})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
    });
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert(L.error, 'Harita uygulaması açılamadı'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{L.nearbyPharmacies}</Text>
          {locDenied && (
            <Text style={styles.locDenied}>{language === 'tr' ? 'İstanbul varsayılan konumu kullanılıyor' : 'Using Istanbul default'}</Text>
          )}
        </View>
        <View style={styles.viewToggle}>
          <AnimatedPressable
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
            disableHaptic
          >
            <List size={20} color={viewMode === 'list' ? colors.textMain : colors.textMuted} />
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            onPress={() => setViewMode('map')}
            disableHaptic
          >
            <MapIcon size={20} color={viewMode === 'map' ? colors.textMain : colors.textMuted} />
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        <AnimatedPressable testID="tab-all" style={[styles.tab, tab === 'all' && styles.tabActive]} onPress={() => setTab('all')}>
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>{L.allPharmacies}</Text>
        </AnimatedPressable>
        <AnimatedPressable testID="tab-oncall" style={[styles.tab, tab === 'oncall' && styles.tabActive]} onPress={() => setTab('oncall')}>
          <Text style={[styles.tabText, tab === 'oncall' && styles.tabTextActive]}>{L.onCallPharmacies}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((r) => (
          <AnimatedPressable
            key={r}
            testID={`filter-${r}`}
            style={[styles.filterChip, radiusM === r && styles.filterChipActive]}
            onPress={() => setRadiusM(r)}
          >
            <Text style={[styles.filterText, radiusM === r && styles.filterTextActive]}>
              {r < 1000 ? `${r}m` : `${r / 1000}km`}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {loading && list.length === 0 && viewMode === 'list' ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 50 }} />
      ) : viewMode === 'map' && Platform.OS !== 'web' ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: coords?.lat || DEFAULT_LOC.lat,
              longitude: coords?.lon || DEFAULT_LOC.lon,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
            onPress={() => setSelectedPharmacy(null)}
          >
            {list.map((p) => {
              if (!p.lat || !p.lon) return null;
              const status = checkStatus(p);
              const color = status === 'on_call' ? colors.error : status === 'open' ? colors.success : colors.textMuted;
              return (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat, longitude: p.lon }}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedPharmacy(p);
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerIconBg, { borderColor: color }]}>
                      <MapPin size={16} color={color} />
                    </View>
                    <Text style={styles.markerName} numberOfLines={1}>
                      {p.name.replace('Eczanesi', '').replace('Eczane', '').trim()}
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          {isRefetching && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {selectedPharmacy && (
            <View style={styles.mapBottomCard}>
              <TouchableOpacity style={styles.closeCardBtn} onPress={() => setSelectedPharmacy(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingRight: 30 }}>
                <Text style={styles.name}>{selectedPharmacy.name}</Text>
                {selectedPharmacy.on_call && (
                  <View style={styles.dutyBadge}>
                    <Text style={styles.dutyText}>{L.onDuty}</Text>
                  </View>
                )}
                {checkStatus(selectedPharmacy) === 'open' && !selectedPharmacy.on_call && (
                  <View style={[styles.dutyBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.dutyText, { color: colors.success }]}>Açık</Text>
                  </View>
                )}
                {checkStatus(selectedPharmacy) === 'closed' && (
                  <View style={[styles.dutyBadge, { backgroundColor: '#F0F0F0' }]}>
                    <Text style={[styles.dutyText, { color: colors.textMuted }]}>Kapalı</Text>
                  </View>
                )}
              </View>
              <Text style={styles.addr}>{selectedPharmacy.address}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Navigation size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{L.distance(selectedPharmacy.distance_m)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{selectedPharmacy.hours}</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <AnimatedPressable style={styles.callBtn} onPress={() => callPharmacy(selectedPharmacy.phone)}>
                  <Phone size={14} color="#fff" />
                  <Text style={styles.callText}>{selectedPharmacy.phone || L.call}</Text>
                </AnimatedPressable>
                <AnimatedPressable style={styles.mapBtn} onPress={() => openMap(selectedPharmacy)}>
                  <MapIcon size={14} color={colors.primary} />
                  <Text style={styles.mapText}>{language === 'tr' ? 'Yol Tarifi' : 'Directions'}</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><MapPin size={36} color={colors.primary} /></View>
          <Text style={styles.emptyText}>{language === 'tr' ? 'Bu mesafede eczane bulunamadı' : 'No pharmacies found in this range'}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          renderItem={({ item, index }) => {
            const status = checkStatus(item);
            return (
              <View testID={`pharmacy-${index}`} style={styles.card}>
                <View style={styles.iconWrap}><MapPin size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.on_call && (
                      <View style={styles.dutyBadge}>
                        <Text style={styles.dutyText}>{L.onDuty}</Text>
                      </View>
                    )}
                    {status === 'open' && !item.on_call && (
                      <View style={[styles.dutyBadge, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[styles.dutyText, { color: colors.success }]}>Açık</Text>
                      </View>
                    )}
                    {status === 'closed' && (
                      <View style={[styles.dutyBadge, { backgroundColor: '#F0F0F0' }]}>
                        <Text style={[styles.dutyText, { color: colors.textMuted }]}>Kapalı</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addr}>{item.address}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Navigation size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{L.distance(item.distance_m)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{item.hours}</Text>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <AnimatedPressable testID={`call-${index}`} style={styles.callBtn} onPress={() => callPharmacy(item.phone)}>
                      <Phone size={14} color="#fff" />
                      <Text style={styles.callText}>{item.phone || L.call}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable testID={`map-${index}`} style={styles.mapBtn} onPress={() => openMap(item)}>
                      <MapIcon size={14} color={colors.primary} />
                      <Text style={styles.mapText}>{language === 'tr' ? 'Yol Tarifi' : 'Directions'}</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  locDenied: { fontSize: 11, color: colors.warning, marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.xxl, backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, marginVertical: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textMain },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xxl, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated },
  filterChipActive: { backgroundColor: colors.secondary },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: colors.textMain },
  card: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12, gap: spacing.md,
    ...shadows.card,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5FA', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: colors.textMain, flexShrink: 1 },
  addr: { fontSize: 13, color: colors.textMuted, marginTop: 4, flexShrink: 1 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  dutyBadge: { backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  dutyText: { color: colors.textMain, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  callBtn: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.secondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, justifyContent: 'center' },
  callText: { color: colors.textMain, fontWeight: '800', fontSize: 13, flexShrink: 1 },
  mapBtn: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5FA', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, justifyContent: 'center' },
  mapText: { color: colors.primary, fontWeight: '800', fontSize: 13, flexShrink: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5FA', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', fontWeight: '600' },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, padding: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  toggleBtnActive: { backgroundColor: colors.surface, ...shadows.card },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerIconBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  markerName: { fontSize: 10, fontWeight: '800', color: colors.textMain, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, borderRadius: 4, marginTop: 2, overflow: 'hidden' },
  mapLoadingOverlay: { position: 'absolute', top: 20, right: 20, backgroundColor: '#fff', padding: 8, borderRadius: 20, ...shadows.card },
  mapBottomCard: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.card },
  closeCardBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 4 },
});
