import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleCheck,
  Droplet,
  Layers,
  Lock,
  Plus,
  ShieldCheck,
  Sun,
  Thermometer,
  Wifi,
} from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { useMobileTelemetry } from '../hooks/useMobileTelemetry';
import { EcGaugeSvg, FarmOneSvg, FarmTwoSvg } from '../components/graphics/NativeGraphics';
import type { ActuatorId, DosingMode, ScreenTab } from '../types/telemetry';
import { clampTargetEc } from '../utils/security';

export const AutogrowMobileApp: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width > 560;

  const {
    metrics,
    actuators,
    activeAlarms,
    setpoint,
    connectionMode,
    endpointUrl,
    hasToken,
    configureConnection,
    resetToDemoMode,
    triggerActuatorPulse,
    acknowledgeAlarm,
  } = useMobileTelemetry();

  const [activeScreen, setActiveScreen] = useState<ScreenTab>('farms');
  const [dosingMode, setDosingMode] = useState<DosingMode>('Auto');
  const [selectedStage, setSelectedStage] = useState<string>('Bloom');
  const [targetEC, setTargetEC] = useState<number>(setpoint.target_ec || 1.8);
  const [lastDoseMsg, setLastDoseMsg] = useState<string>('12 mins ago');

  // Mandatory Two-Step Safety Confirmation before any pump/valve command
  const [pendingPulse, setPendingPulse] = useState<{
    actuatorId: ActuatorId;
    label: string;
    durationSec: number;
  } | null>(null);
  const [pulseFeedback, setPulseFeedback] = useState<string | null>(null);

  // Secure Endpoint Pairing Form State
  const [urlInput, setUrlInput] = useState<string>(endpointUrl);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingStatusMsg, setPairingStatusMsg] = useState<string | null>(null);
  const [otaStatusMsg, setOtaStatusMsg] = useState<string | null>(null);
  const [isCheckingOta, setIsCheckingOta] = useState<boolean>(false);

  const handleCheckOtaUpdate = async () => {
    if (Platform.OS === 'web' || !Updates.isEnabled) {
      setOtaStatusMsg('OTA updates run automatically inside installed APK / store builds.');
      return;
    }
    setIsCheckingOta(true);
    setOtaStatusMsg('Checking Expo Cloud CDN for updates...');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setOtaStatusMsg('You already have the latest version installed.');
        return;
      }
      setOtaStatusMsg('Downloading new update from Expo Cloud CDN...');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setOtaStatusMsg('Unable to reach Expo Cloud CDN right now. Try again later.');
    } finally {
      setIsCheckingOta(false);
    }
  };

  const stagePresets = [
    { label: 'Seedling', target: 0.8 },
    { label: 'Veg', target: 1.4 },
    { label: 'Bloom', target: 1.8 },
    { label: 'Peak', target: 2.2 },
  ];

  const isInterlockLocked = dosingMode === 'Off';

  const requestSafePulse = (actuatorId: ActuatorId, label: string, durationSec: number) => {
    if (isInterlockLocked) {
      setPulseFeedback('Blocked: Dosing mode is set to OFF (Safety Lock active).');
      setTimeout(() => setPulseFeedback(null), 2600);
      return;
    }
    setPendingPulse({ actuatorId, label, durationSec });
  };

  const confirmAndRunPulse = async () => {
    if (!pendingPulse) return;
    const { actuatorId, label, durationSec } = pendingPulse;
    setPendingPulse(null);
    const ok = await triggerActuatorPulse(actuatorId, durationSec);
    if (ok) {
      setLastDoseMsg(`Just now (${label} · ${durationSec}s)`);
      setPulseFeedback(`Dispatched ${durationSec}s bounded pulse to ${label}`);
    } else {
      setPulseFeedback(`Command rejected or Edge Server unreachable.`);
    }
    setTimeout(() => setPulseFeedback(null), 2800);
  };

  const handleSaveConnection = async () => {
    setPairingError(null);
    setPairingStatusMsg(null);
    const res = await configureConnection(urlInput, tokenInput);
    if (!res.ok) {
      setPairingError(res.error);
      return;
    }
    setTokenInput('');
    setPairingStatusMsg(
      urlInput.trim()
        ? 'Secure endpoint validated and stored cleanly.'
        : 'Switched to Safe Demo Simulation Mode.'
    );
  };

  const handleClearCredentials = async () => {
    await resetToDemoMode();
    setUrlInput('');
    setTokenInput('');
    setPairingError(null);
    setPairingStatusMsg('Credentials cleared. Running in Safe Demo Mode.');
  };

  const statusBadgeText =
    connectionMode === 'CONNECTED'
      ? 'TLS EDGE ONLINE'
      : connectionMode === 'CONNECTING'
        ? 'CONNECTING...'
        : connectionMode === 'OFFLINE'
          ? 'EDGE OFFLINE'
          : 'SAFE DEMO MODE';

  const statusBadgeColor =
    connectionMode === 'CONNECTED'
      ? '#15803D'
      : connectionMode === 'DEMO_SAFE'
        ? '#0369A1'
        : '#B45309';

  const statusBadgeBg =
    connectionMode === 'CONNECTED'
      ? '#DCFCE7'
      : connectionMode === 'DEMO_SAFE'
        ? '#E0F2FE'
        : '#FEF3C7';

  return (
    <SafeAreaView style={[styles.safeRoot, isWideWeb && styles.wideRoot]}>
      <View style={[styles.phoneContainer, isWideWeb && styles.phoneDesktopFrame]}>
        {/* Main Scrollable Screen Body */}
        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* ================= SCREEN 1: MY FARMS ================= */}
          {activeScreen === 'farms' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenStart}>
                <View>
                  <Text style={styles.pageTitle}>My farms</Text>
                  <View style={styles.liveSubtitleRow}>
                    <View style={[styles.dotIndicator, { backgroundColor: '#15803D' }]} />
                    <Text style={styles.liveSubtitle}>
                      {connectionMode === 'DEMO_SAFE' ? 'Safe Demo Telemetry Active' : 'Live Edge Telemetry'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.pillBadge, { backgroundColor: statusBadgeBg }]}>
                  <Text style={[styles.pillBadgeText, { color: statusBadgeColor }]}>{statusBadgeText}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryDarkBtn}
                onPress={() => setActiveScreen('pairing')}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.primaryDarkBtnText}>Connect Edge / Pair Device</Text>
              </TouchableOpacity>

              {/* 3 Summary KPI Cards */}
              <View style={styles.kpiRow3}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Tanks</Text>
                  <Text style={styles.kpiValue}>10</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, activeAlarms.length > 0 && { color: '#DC2626' }]}>Alarms</Text>
                  <Text style={[styles.kpiValue, activeAlarms.length > 0 && { color: '#DC2626' }]}>
                    {activeAlarms.length}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Offline</Text>
                  <Text style={styles.kpiValue}>0</Text>
                </View>
              </View>

              {/* Farm 1 Card */}
              <TouchableOpacity
                style={styles.farmCard}
                onPress={() => setActiveScreen('telemetry')}
                activeOpacity={0.88}
              >
                <View style={styles.farmArtWrap}>
                  <FarmOneSvg />
                </View>
                <View style={styles.rowBetweenCenter}>
                  <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>ALL ONLINE</Text>
                  </View>
                  <Text style={styles.mutedSmall}>Cameron Highlands</Text>
                </View>
                <Text style={styles.farmTitle}>Highlands Hydroponics</Text>
                <View style={styles.farmCardFooter}>
                  <Text style={styles.farmMeta}>4 Tanks Active</Text>
                  <Text style={styles.farmMeta}>
                    Avg EC: <Text style={styles.farmEcStrong}>{metrics.ec.toFixed(2)} mS/cm</Text>
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Farm 2 Card */}
              <TouchableOpacity
                style={styles.farmCard}
                onPress={() => setActiveScreen('telemetry')}
                activeOpacity={0.88}
              >
                <View style={styles.farmArtWrap}>
                  <FarmTwoSvg />
                </View>
                <View style={styles.rowBetweenCenter}>
                  <View style={[styles.pillBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.pillBadgeText, { color: '#B45309' }]}>1 ATTENTION</Text>
                  </View>
                  <Text style={styles.mutedSmall}>Genting Highlands</Text>
                </View>
                <Text style={styles.farmTitle}>Pahang Berry Bay</Text>
                <View style={styles.farmCardFooter}>
                  <Text style={styles.farmMeta}>6 Tanks Active</Text>
                  <Text style={styles.farmMeta}>
                    Avg EC: <Text style={styles.farmEcStrong}>2.12 mS/cm</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= SCREEN 2: TANK TELEMETRY ================= */}
          {activeScreen === 'telemetry' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <TouchableOpacity onPress={() => setActiveScreen('farms')} style={styles.backLinkRow}>
                  <ArrowLeft size={14} color="#15803D" />
                  <Text style={styles.backLinkText}>All farms</Text>
                </TouchableOpacity>
                <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>LIVE TELEMETRY</Text>
                </View>
              </View>

              <View>
                <Text style={styles.sectionHeading}>Tank 1 - Bloom NFT</Text>
                <Text style={styles.mutedSmall}>Highlands Hydroponics · Zone 01</Text>
              </View>

              {/* Curved EC Sweep Gauge */}
              <View style={styles.whiteCardCenter}>
                <Text style={styles.cardUpperLabel}>ELECTRICAL CONDUCTIVITY (EC)</Text>
                <EcGaugeSvg ec={metrics.ec} target={targetEC} lowLimit={1.4} highLimit={2.2} />
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepCircleBtn}
                    onPress={() => setTargetEC((prev) => clampTargetEc(prev - 0.1))}
                  >
                    <Text style={styles.stepCircleText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.targetLabel}>
                    Target: <Text style={{ color: '#15803D', fontWeight: '800' }}>{targetEC.toFixed(1)}</Text> mS
                  </Text>
                  <TouchableOpacity
                    style={styles.stepCircleBtn}
                    onPress={() => setTargetEC((prev) => clampTargetEc(prev + 0.1))}
                  >
                    <Text style={styles.stepCircleText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* pH & Water Temp */}
              <View style={styles.grid2}>
                <View style={styles.metricTile}>
                  <View style={styles.metricIconRow}>
                    <Droplet size={13} color="#0284C7" />
                    <Text style={styles.metricTileLabel}>pH Level</Text>
                  </View>
                  <Text style={styles.metricTileVal}>{metrics.ph.toFixed(2)}</Text>
                  <Text style={styles.metricOkText}>Optimal (5.8–6.2)</Text>
                </View>
                <View style={styles.metricTile}>
                  <View style={styles.metricIconRow}>
                    <Thermometer size={13} color="#D97706" />
                    <Text style={styles.metricTileLabel}>Water Temp</Text>
                  </View>
                  <Text style={styles.metricTileVal}>{metrics.temp_water.toFixed(1)}°C</Text>
                  <Text style={styles.metricOkText}>Chiller Stable</Text>
                </View>
              </View>

              {/* Climate Row */}
              <View style={styles.kpiRow3}>
                <View style={styles.kpiCard}>
                  <Text style={styles.climateMicroLabel}>AIR TEMP</Text>
                  <Text style={styles.climateVal}>{metrics.temp_air.toFixed(1)}°C</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.climateMicroLabel}>VPD</Text>
                  <Text style={[styles.climateVal, { color: '#15803D' }]}>{metrics.vpd.toFixed(2)} kPa</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.climateMicroLabel}>CO2</Text>
                  <Text style={styles.climateVal}>{metrics.co2}</Text>
                </View>
              </View>

              {/* Crop Stage Presets */}
              <View style={styles.whiteCard}>
                <Text style={styles.cardSubTitle}>Crop Stage Presets:</Text>
                <View style={styles.presetRow}>
                  {stagePresets.map((st) => {
                    const active = selectedStage === st.label;
                    return (
                      <TouchableOpacity
                        key={st.label}
                        style={[styles.presetBtn, active && styles.presetBtnActive]}
                        onPress={() => {
                          setSelectedStage(st.label);
                          setTargetEC(clampTargetEc(st.target));
                        }}
                      >
                        <Text style={[styles.presetText, active && styles.presetTextActive]}>{st.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryDarkBtn}
                onPress={() => setActiveScreen('dosing')}
                activeOpacity={0.85}
              >
                <Droplet size={15} color="#76b82a" />
                <Text style={styles.primaryDarkBtnText}>Open Dosing & Injection Controls</Text>
                <ChevronRight size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= SCREEN 3: DOSING & SAFETY INTERLOCK ================= */}
          {activeScreen === 'dosing' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <View>
                  <Text style={styles.sectionHeading}>Dosing Controls</Text>
                  <Text style={styles.mutedSmall}>4-Channel Closed-Loop · Two-Step Safety Guard</Text>
                </View>
                <View style={[styles.pillBadge, { backgroundColor: isInterlockLocked ? '#FEE2E2' : '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: isInterlockLocked ? '#DC2626' : '#15803D' }]}>
                    {isInterlockLocked ? 'LOCKED (OFF)' : 'INTERLOCK SAFE'}
                  </Text>
                </View>
              </View>

              {pulseFeedback && (
                <View style={styles.feedbackBanner}>
                  <Text style={styles.feedbackBannerText}>{pulseFeedback}</Text>
                </View>
              )}

              {/* 4-Channel Pump Grid */}
              <View style={styles.pumpGrid}>
                {(
                  [
                    { id: 'pump-nutrient-a', name: 'Nutrient A (NPK)' },
                    { id: 'pump-nutrient-b', name: 'Nutrient B (Micro)' },
                    { id: 'pump-acid', name: 'pH Down (Acid)' },
                    { id: 'valve-irrigation-1', name: 'Irrigation Valve' },
                  ] as const
                ).map((ch) => {
                  const st = actuators[ch.id];
                  const isActive = st?.status === 'ACTIVE' && st.remaining_seconds > 0;
                  return (
                    <View key={ch.id} style={[styles.pumpCard, isActive && styles.pumpCardActive]}>
                      <Text style={styles.pumpIdLabel}>{ch.id.toUpperCase()}</Text>
                      <Text style={styles.pumpName}>{ch.name}</Text>
                      <View style={styles.rowBetweenCenter}>
                        <Text style={[styles.pumpState, isActive && { color: '#15803D' }]}>
                          {isActive ? `RUNNING (${st.remaining_seconds}s)` : 'STANDBY'}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.smallPulseBtn,
                            (isActive || isInterlockLocked) && { backgroundColor: '#CBD5E1' },
                          ]}
                          disabled={isActive}
                          onPress={() => requestSafePulse(ch.id, ch.name, 8)}
                        >
                          <Text style={styles.smallPulseBtnText}>Pulse 8s</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Dosing Mode Interlock Switch */}
              <View style={[styles.whiteCard, styles.rowBetweenCenter]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Lock size={14} color="#374151" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151' }}>Safety Mode:</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['Auto', 'Manual', 'Off'] as const).map((mode) => {
                    const active = dosingMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.modeChip,
                          active && { backgroundColor: mode === 'Off' ? '#DC2626' : '#111827' },
                        ]}
                        onPress={() => setDosingMode(mode)}
                      >
                        <Text style={[styles.modeChipText, active && { color: '#FFFFFF' }]}>{mode}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryDarkBtn, isInterlockLocked && { backgroundColor: '#9CA3AF' }]}
                onPress={() => requestSafePulse('pump-acid', 'Nutrient Skid Calibration', 10)}
                activeOpacity={0.85}
              >
                <Droplet size={15} color="#76b82a" />
                <Text style={styles.primaryDarkBtnText}>Pulse Dose 10s (Confirm Required)</Text>
              </TouchableOpacity>

              <Text style={{ textAlign: 'center', fontSize: 11, color: '#6B7280' }}>
                Last command: {lastDoseMsg}
              </Text>
            </View>
          )}

          {/* ================= SCREEN 4: SUBSTRATE & ROOTZONE ================= */}
          {activeScreen === 'substrate' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <View>
                  <Text style={styles.sectionHeading}>Substrate Root-Zone</Text>
                  <Text style={styles.mutedSmall}>Grodan 100cm Rockwool Slab Sensor</Text>
                </View>
                <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>TDR PROBE</Text>
                </View>
              </View>

              <View style={styles.whiteCardCenter}>
                <Text style={styles.cardUpperLabel}>VOLUMETRIC WATER CONTENT (VWC)</Text>
                <Text style={styles.hugeMonoValue}>{metrics.vwc.toFixed(1)}%</Text>
                <Text style={styles.metricOkText}>Optimal Target: 60% – 68%</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, metrics.vwc)}%` }]} />
                </View>
              </View>

              <View style={styles.grid2}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricTileLabel}>Pore Water EC</Text>
                  <Text style={styles.metricTileVal}>{metrics.rootzone_pore_ec.toFixed(2)} mS</Text>
                  <Text style={styles.metricOkText}>Salt Balance Normal</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricTileLabel}>Slab Temp</Text>
                  <Text style={styles.metricTileVal}>20.8°C</Text>
                  <Text style={styles.metricOkText}>Within Root Range</Text>
                </View>
              </View>

              <View style={styles.whiteCard}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                  Dry-Back Steering Profile:
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', lineHeight: 18 }}>
                  Generative steering active: overnight dry-back capped at 12%. Morning irrigation triggers at 100 W/m² solar accumulation.
                </Text>
              </View>
            </View>
          )}

          {/* ================= SCREEN 5: ALARMS ================= */}
          {activeScreen === 'alarms' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <View>
                  <Text style={styles.sectionHeading}>Active Alarms</Text>
                  <Text style={styles.mutedSmall}>Edge Safety & Interlock Monitoring</Text>
                </View>
                <View style={[styles.pillBadge, { backgroundColor: activeAlarms.length > 0 ? '#FEE2E2' : '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: activeAlarms.length > 0 ? '#DC2626' : '#15803D' }]}>
                    {activeAlarms.length > 0 ? `${activeAlarms.length} ACTIVE` : 'ALL CLEAR'}
                  </Text>
                </View>
              </View>

              {activeAlarms.length === 0 ? (
                <View style={[styles.whiteCardCenter, { paddingVertical: 28 }]}>
                  <CircleCheck size={36} color="#15803D" />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 10 }}>
                    No Active Edge Alarms
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>
                    All sensors, dosing pumps, and tanks are operating within safe agronomic limits.
                  </Text>
                </View>
              ) : (
                activeAlarms.map((alarm) => (
                  <View key={alarm.alarm_id} style={[styles.whiteCard, { borderColor: '#FCA5A5' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>{alarm.severity}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginVertical: 4 }}>{alarm.code}</Text>
                    <Text style={{ fontSize: 12, color: '#4B5563', marginBottom: 10 }}>{alarm.message}</Text>
                    <TouchableOpacity
                      style={styles.smallPulseBtn}
                      onPress={() => acknowledgeAlarm(alarm.alarm_id)}
                    >
                      <Text style={styles.smallPulseBtnText}>Acknowledge Alarm</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ================= SCREEN 6: SECURE EDGE PAIRING & CONNECTION ================= */}
          {activeScreen === 'pairing' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <TouchableOpacity onPress={() => setActiveScreen('farms')} style={styles.backLinkRow}>
                  <ArrowLeft size={14} color="#15803D" />
                  <Text style={styles.backLinkText}>Back to Farms</Text>
                </TouchableOpacity>
                <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>TLS + SECURE STORE</Text>
                </View>
              </View>

              <View>
                <Text style={styles.sectionHeading}>Secure Edge Pairing</Text>
                <Text style={styles.mutedSmall}>
                  Connect via encrypted HTTPS tunnel (recommended for remote access) or private farm Wi-Fi LAN IP.
                </Text>
              </View>

              <View style={styles.whiteCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <ShieldCheck size={18} color="#15803D" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>
                    Connection Security Policy
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 17 }}>
                  • Public internet access strictly requires HTTPS/WSS encryption.{'\n'}
                  • Credentials are stored encrypted in iOS Keychain / Android Keystore (never web localStorage).{'\n'}
                  • Leave blank to run in Safe Demo Simulation Mode.
                </Text>
              </View>

              <View style={styles.whiteCard}>
                <Text style={styles.inputLabel}>Edge Server URL (HTTPS or Private LAN)</Text>
                <TextInput
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="https://edge.yourfarm.com or http://192.168.1.50:8080"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.textInput}
                />

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                  Operator API Bearer Token {hasToken ? '(Saved in Vault)' : '(Optional)'}
                </Text>
                <TextInput
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  placeholder="Paste operator bearer token"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.textInput}
                />

                {pairingError && <Text style={styles.errorText}>{pairingError}</Text>}
                {pairingStatusMsg && <Text style={styles.successText}>{pairingStatusMsg}</Text>}

                <TouchableOpacity
                  style={[styles.primaryDarkBtn, { marginTop: 12, backgroundColor: '#15803D' }]}
                  onPress={handleSaveConnection}
                >
                  <Wifi size={15} color="#FFFFFF" />
                  <Text style={styles.primaryDarkBtnText}>Save & Connect Safely</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryOutlineBtn} onPress={handleClearCredentials}>
                  <Text style={styles.secondaryOutlineText}>Wipe Credentials & Use Safe Demo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.whiteCard}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
                  App Version & Cloud OTA Updates
                </Text>
                <Text style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 8 }}>
                  Version 1.0.0 · Channel: {Updates.channel || (Platform.OS === 'web' ? 'web' : 'expo-go / local')}
                </Text>
                {otaStatusMsg && (
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#15803D', marginBottom: 8 }}>
                    {otaStatusMsg}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.secondaryOutlineBtn}
                  disabled={isCheckingOta}
                  onPress={handleCheckOtaUpdate}
                >
                  <Text style={styles.secondaryOutlineText}>
                    {isCheckingOta ? 'Checking...' : 'Check for OTA Update'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom 5-Tab Bar */}
        <View style={styles.bottomTabBar}>
          {(
            [
              { id: 'farms', label: 'Farms', Icon: Layers },
              { id: 'telemetry', label: 'Telemetry', Icon: Activity },
              { id: 'dosing', label: 'Dosing', Icon: Droplet },
              { id: 'substrate', label: 'Substrate', Icon: Sun },
              { id: 'alarms', label: `Alarms (${activeAlarms.length})`, Icon: Bell },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = activeScreen === id;
            return (
              <TouchableOpacity key={id} style={styles.tabBtn} onPress={() => setActiveScreen(id)}>
                <Icon size={18} color={active ? '#15803D' : '#6B7280'} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Two-Step Hardware Safety Confirmation Modal */}
      <Modal
        transparent
        visible={Boolean(pendingPulse)}
        animationType="fade"
        onRequestClose={() => setPendingPulse(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ShieldCheck size={20} color="#15803D" />
              <Text style={styles.modalTitle}>Confirm Bounded Pump Pulse</Text>
            </View>
            {pendingPulse && (
              <Text style={styles.modalDesc}>
                You are about to pulse{' '}
                <Text style={{ fontWeight: '800', color: '#111827' }}>{pendingPulse.label}</Text> (
                {pendingPulse.actuatorId}) for{' '}
                <Text style={{ fontWeight: '800', color: '#15803D' }}>{pendingPulse.durationSec}s</Text>.
                {'\n\n'}
                Mode: {connectionMode === 'DEMO_SAFE' ? 'Simulated Demo (Zero live dosing)' : `Live Edge (${endpointUrl})`}.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.secondaryOutlineBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => setPendingPulse(null)}
              >
                <Text style={styles.secondaryOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryDarkBtn, { flex: 1, backgroundColor: '#15803D' }]}
                onPress={confirmAndRunPulse}
              >
                <Text style={styles.primaryDarkBtnText}>Confirm Pulse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: '#F9FAFB' },
  wideRoot: { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  phoneContainer: { flex: 1, width: '100%', backgroundColor: '#F9FAFB' },
  phoneDesktopFrame: {
    maxWidth: 430,
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#1E293B',
  },
  scrollBody: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  screenGap: { gap: 14 },
  rowBetweenStart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowBetweenCenter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.4 },
  sectionHeading: { fontSize: 20, fontWeight: '800', color: '#111827' },
  liveSubtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dotIndicator: { width: 7, height: 7, borderRadius: 4 },
  liveSubtitle: { fontSize: 11.5, fontWeight: '700', color: '#15803D' },
  mutedSmall: { fontSize: 11.5, color: '#6B7280' },
  pillBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillBadgeText: { fontSize: 10, fontWeight: '800' },
  primaryDarkBtn: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryDarkBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondaryOutlineBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryOutlineText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  kpiRow3: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  kpiLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },
  farmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 6,
  },
  farmArtWrap: { alignItems: 'center', marginBottom: 4 },
  farmTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  farmCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    marginTop: 2,
  },
  farmMeta: { fontSize: 12, color: '#4B5563' },
  farmEcStrong: { color: '#15803D', fontWeight: '800' },
  backLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLinkText: { fontSize: 12.5, fontWeight: '700', color: '#15803D' },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  whiteCardCenter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  cardUpperLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  cardSubTitle: { fontSize: 11.5, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  stepCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: { fontSize: 16, fontWeight: '800', color: '#111827' },
  targetLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
  grid2: { flexDirection: 'row', gap: 8 },
  metricTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  metricIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  metricTileLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  metricTileVal: { fontSize: 18, fontWeight: '800', color: '#111827', marginVertical: 2 },
  metricOkText: { fontSize: 10.5, color: '#15803D', fontWeight: '700' },
  climateMicroLabel: { fontSize: 9.5, color: '#6B7280', fontWeight: '700' },
  climateVal: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 2 },
  presetRow: { flexDirection: 'row', gap: 6 },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  presetBtnActive: { borderColor: '#76b82a', backgroundColor: '#F0FDF4' },
  presetText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  presetTextActive: { color: '#15803D' },
  pumpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pumpCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 5,
  },
  pumpCardActive: { borderColor: '#15803D', backgroundColor: '#F0FDF4' },
  pumpIdLabel: { fontSize: 9.5, fontWeight: '700', color: '#6B7280' },
  pumpName: { fontSize: 13, fontWeight: '800', color: '#111827' },
  pumpState: { fontSize: 10.5, fontWeight: '700', color: '#6B7280' },
  smallPulseBtn: { backgroundColor: '#111827', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  smallPulseBtnText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  modeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F3F4F6' },
  modeChipText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  feedbackBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 8,
  },
  feedbackBannerText: { fontSize: 11.5, fontWeight: '700', color: '#065F46' },
  hugeMonoValue: { fontSize: 38, fontWeight: '900', color: '#111827', marginVertical: 4 },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#15803D', borderRadius: 999 },
  inputLabel: { fontSize: 11.5, fontWeight: '700', color: '#374151', marginBottom: 4 },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  errorText: { fontSize: 11.5, fontWeight: '700', color: '#DC2626', marginTop: 8 },
  successText: { fontSize: 11.5, fontWeight: '700', color: '#15803D', marginTop: 8 },
  bottomTabBar: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  tabLabelActive: { color: '#15803D', fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalDesc: { fontSize: 12.5, color: '#4B5563', lineHeight: 18 },
});
