import React, { useState, useEffect } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  Text,
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
import { EcGaugeSvg } from '../components/graphics/NativeGraphics';
import {
  AddDeviceView,
  AddFarmView,
  ControllersListView,
  FacilitiesListView,
  FarmsHomeView,
} from '../components/HierarchyScreens';
import { SENSOR_SPECS } from '../data/farmsSeed';
import type {
  ActuatorId,
  AttachedSensor,
  DosingMode,
  ScreenTab,
  SensorType,
} from '../types/telemetry';
import { clampTargetEc } from '../utils/security';
import { mobileStyles as styles } from '../styles/mobileStyles';

export const AutogrowMobileApp: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width > 560;

  const {
    farms,
    selectedFarm,
    selectedFacility,
    selectedController,
    selectFarm,
    selectFacility,
    selectController,
    addFarm,
    addFacility,
    linkControllerDevice,
    attachSensorToController,
    metrics,
    actuators,
    activeAlarms,
    setpoint,
    connectionMode,
    endpointUrl,
    hasToken,
    resetToDemoMode,
    triggerActuatorPulse,
    acknowledgeAlarm,
  } = useMobileTelemetry();

  const [activeScreen, setActiveScreen] = useState<ScreenTab>('farms');
  const [returnScreen, setReturnScreen] = useState<ScreenTab>('farms');
  const [dosingMode, setDosingMode] = useState<DosingMode>('Auto');
  const [selectedStage, setSelectedStage] = useState<string>('Bloom');
  const [targetEC, setTargetEC] = useState<number>(setpoint.target_ec || 1.8);
  const [lastDoseMsg, setLastDoseMsg] = useState<string>('12 mins ago');
  const [showAttachSensorMenu, setShowAttachSensorMenu] = useState<boolean>(false);

  // Sync Target EC whenever the selected Facility/Controller changes
  useEffect(() => {
    setTargetEC(clampTargetEc(setpoint.target_ec || 1.8));
  }, [setpoint.target_ec, selectedFacility.id, selectedController.id]);

  // Mandatory Two-Step Safety Confirmation before any pump/valve command
  const [pendingPulse, setPendingPulse] = useState<{
    actuatorId: ActuatorId;
    label: string;
    durationSec: number;
  } | null>(null);
  const [pulseFeedback, setPulseFeedback] = useState<string | null>(null);

  // Cloud OTA Updater Feedback
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
      setLastDoseMsg(`Just now (${selectedController.serial} · ${label} · ${durationSec}s)`);
      setPulseFeedback(`Dispatched ${durationSec}s bounded pulse to ${label}`);
    } else {
      setPulseFeedback('Command rejected or Edge Server unreachable.');
    }
    setTimeout(() => setPulseFeedback(null), 2800);
  };

  const openAddDeviceFlow = (from: ScreenTab) => {
    setReturnScreen(from);
    setActiveScreen('pairing');
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

  const getLiveSensorDisplayValue = (sensor: AttachedSensor): string => {
    switch (sensor.type) {
      case 'ec':
        return metrics.ec.toFixed(2);
      case 'ph':
        return metrics.ph.toFixed(2);
      case 'vpd':
        return metrics.vpd.toFixed(2);
      case 'vwc':
        return metrics.vwc.toFixed(1);
      case 'temp':
        return metrics.temp_water.toFixed(1);
      case 'co2':
        return String(metrics.co2);
      default:
        return String(sensor.value);
    }
  };

  const activeScopeLabel = `${selectedFarm.name} › ${selectedFacility.name.split('·')[0].trim()} › ${selectedController.model} (${selectedController.serial})`;

  return (
    <SafeAreaView style={[styles.safeRoot, isWideWeb && styles.wideRoot]}>
      <View style={[styles.phoneContainer, isWideWeb && styles.phoneDesktopFrame]}>
        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* ================= LEVEL 1: MY FARMS / PLACES ================= */}
          {activeScreen === 'farms' && (
            <FarmsHomeView
              farms={farms}
              activeAlarmsCount={activeAlarms.length}
              connectionMode={connectionMode}
              statusBadgeText={statusBadgeText}
              statusBadgeColor={statusBadgeColor}
              statusBadgeBg={statusBadgeBg}
              onOpenFarm={(farmId) => {
                selectFarm(farmId);
                setActiveScreen('facilities');
              }}
              onOpenAddFarm={() => setActiveScreen('add_farm')}
              onOpenAddDevice={() => openAddDeviceFlow('farms')}
            />
          )}

          {/* ================= LEVEL 2: FACILITIES IN CLICKED FARM ================= */}
          {activeScreen === 'facilities' && (
            <FacilitiesListView
              farm={selectedFarm}
              onBackToFarms={() => setActiveScreen('farms')}
              onOpenFacility={(facilityId) => {
                selectFacility(facilityId);
                setActiveScreen('controllers');
              }}
              onOpenAddDeviceForFarm={() => openAddDeviceFlow('facilities')}
              onAddFacility={(farmId, input) => {
                const res = addFacility(farmId, input);
                if (res.ok) {
                  setActiveScreen('controllers');
                }
                return res;
              }}
            />
          )}

          {/* ================= LEVEL 3: CONTROLLERS IN CLICKED FACILITY ================= */}
          {activeScreen === 'controllers' && (
            <ControllersListView
              farm={selectedFarm}
              facility={selectedFacility}
              selectedControllerId={selectedController.id}
              onBackToFacilities={() => setActiveScreen('facilities')}
              onJumpToFarms={() => setActiveScreen('farms')}
              onSelectController={(controllerId) => {
                selectController(controllerId);
                setActiveScreen('telemetry');
              }}
              onLinkControllerToFacility={() => openAddDeviceFlow('controllers')}
            />
          )}

          {/* ================= LEVEL 4: SELECTED CONTROLLER SENSORS & LIVE TELEMETRY ================= */}
          {activeScreen === 'telemetry' && (
            <View style={styles.screenGap}>
              <View style={styles.rowBetweenCenter}>
                <TouchableOpacity
                  onPress={() => setActiveScreen('controllers')}
                  style={styles.backLinkRow}
                >
                  <ArrowLeft size={14} color="#15803D" />
                  <Text style={styles.backLinkText}>Controllers</Text>
                </TouchableOpacity>
                <View style={styles.rowGap8}>
                  <TouchableOpacity
                    onPress={() => setActiveScreen('facilities')}
                    style={styles.crumbChip}
                  >
                    <Text style={styles.crumbChipText}>Facilities</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setActiveScreen('farms')}
                    style={styles.crumbChip}
                  >
                    <Text style={styles.crumbChipText}>All Farms</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Active Controller Hardware Scope Card */}
              <View style={styles.scopeBanner}>
                <Text style={styles.scopePathText}>
                  {selectedFarm.name} › {selectedFacility.name}
                </Text>
                <View style={styles.rowBetweenCenter}>
                  <Text style={styles.scopeCtrlTitle}>{selectedController.model}</Text>
                  <Text style={styles.scopeCtrlMeta}>{selectedController.serial}</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#CBD5E1' }}>
                  IP {selectedController.ipAddress} · {selectedController.rssi} dBm · FW{' '}
                  {selectedController.firmware} · {selectedController.doseCountHour} DC/h
                </Text>
                <View style={[styles.actionPairRow, { marginTop: 4 }]}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryOutlineBtn,
                      {
                        flex: 1,
                        marginTop: 0,
                        paddingVertical: 7,
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                      },
                    ]}
                    onPress={() => openAddDeviceFlow('telemetry')}
                  >
                    <Wifi size={12} color="#34D399" />
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      Link Edge / OTA
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryEmeraldBtn, { flex: 1, paddingVertical: 7 }]}
                    onPress={() => setActiveScreen('dosing')}
                  >
                    <Droplet size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                      Dosing Controls
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Controller's Attached Sensors Section */}
              <View style={styles.rowBetweenCenter}>
                <View>
                  <Text style={styles.sectionHeading}>
                    Attached Sensors ({selectedController.sensors.length})
                  </Text>
                  <Text style={styles.mutedSmall}>
                    Probes wired to {selectedController.serial}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAttachSensorMenu((v) => !v)}
                  style={styles.crumbChip}
                >
                  <Text style={[styles.crumbChipText, { color: '#15803D' }]}>
                    + Attach Sensor
                  </Text>
                </TouchableOpacity>
              </View>

              {showAttachSensorMenu && (
                <View style={styles.whiteCard}>
                  <Text style={styles.cardSubTitle}>
                    Attach New Probe to {selectedController.serial}:
                  </Text>
                  <View style={styles.presetRow}>
                    {(Object.keys(SENSOR_SPECS) as SensorType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.presetBtn}
                        onPress={() => {
                          attachSensorToController(
                            selectedFarm.id,
                            selectedFacility.id,
                            selectedController.id,
                            type
                          );
                          setShowAttachSensorMenu(false);
                        }}
                      >
                        <Text style={styles.presetText}>+ {type.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {selectedController.sensors.map((sensor) => {
                const isAlert = sensor.status === 'ALERT';
                return (
                  <View
                    key={sensor.id}
                    style={[styles.listCard, isAlert && { borderColor: '#FCD34D' }]}
                  >
                    <View style={styles.rowBetweenCenter}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#111827', flex: 1 }}>
                        {sensor.name}
                      </Text>
                      <View style={styles.pinBadge}>
                        <Text style={styles.pinBadgeText}>{sensor.pin}</Text>
                      </View>
                    </View>
                    <View style={styles.rowBetweenCenter}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#15803D' }}>
                        {getLiveSensorDisplayValue(sensor)}{' '}
                        <Text style={{ fontSize: 11.5, color: '#6B7280', fontWeight: '700' }}>
                          {sensor.unit}
                        </Text>
                      </Text>
                      <View
                        style={[
                          styles.pillBadge,
                          { backgroundColor: isAlert ? '#FEF3C7' : '#DCFCE7' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: isAlert ? '#B45309' : '#15803D' },
                          ]}
                        >
                          {sensor.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Curved EC Sweep Gauge & Target Stepper */}
              <View style={styles.whiteCardCenter}>
                <Text style={styles.cardUpperLabel}>ELECTRICAL CONDUCTIVITY (EC)</Text>
                <EcGaugeSvg ec={metrics.ec} target={targetEC} lowLimit={1.4} highLimit={2.4} />
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>Dosing Controls</Text>
                  <Text style={styles.mutedSmall}>{activeScopeLabel}</Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>Substrate Root-Zone</Text>
                  <Text style={styles.mutedSmall}>{activeScopeLabel}</Text>
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
                  <Text style={styles.metricTileVal}>{metrics.temp_water.toFixed(1)}°C</Text>
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

          {/* ================= ADD FARM / PLACE SCREEN ================= */}
          {activeScreen === 'add_farm' && (
            <AddFarmView
              onBack={() => setActiveScreen('farms')}
              onCreateFarm={(input) => {
                const res = addFarm(input);
                if (res.ok) {
                  setActiveScreen('facilities');
                }
                return res;
              }}
            />
          )}

          {/* ================= ADD & LINK CONTROLLER DEVICE SCREEN ================= */}
          {activeScreen === 'pairing' && (
            <AddDeviceView
              farms={farms}
              initialFarmId={selectedFarm.id}
              initialFacilityId={selectedFacility.id}
              endpointUrl={endpointUrl}
              hasToken={hasToken}
              onBack={() => setActiveScreen(returnScreen)}
              onLinkDevice={linkControllerDevice}
              onOpenLinkedController={() => setActiveScreen('telemetry')}
              onResetCredentials={resetToDemoMode}
              otaStatusMsg={otaStatusMsg}
              isCheckingOta={isCheckingOta}
              onCheckOtaUpdate={handleCheckOtaUpdate}
            />
          )}
        </ScrollView>

        {/* Bottom 5-Tab Bar */}
        <View style={styles.bottomTabBar}>
          {(
            [
              {
                id: 'farms',
                label: 'Farms',
                Icon: Layers,
                match: ['farms', 'facilities', 'controllers', 'add_farm', 'pairing'],
              },
              { id: 'telemetry', label: 'Sensors', Icon: Activity, match: ['telemetry'] },
              { id: 'dosing', label: 'Dosing', Icon: Droplet, match: ['dosing'] },
              { id: 'substrate', label: 'Substrate', Icon: Sun, match: ['substrate'] },
              {
                id: 'alarms',
                label: `Alarms (${activeAlarms.length})`,
                Icon: Bell,
                match: ['alarms'],
              },
            ] as const
          ).map(({ id, label, Icon, match }) => {
            const active = (match as readonly string[]).includes(activeScreen);
            return (
              <TouchableOpacity
                key={id}
                style={styles.tabBtn}
                onPress={() => setActiveScreen(id)}
              >
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
                {pendingPulse.actuatorId}) on{' '}
                <Text style={{ fontWeight: '800', color: '#111827' }}>
                  {selectedController.serial}
                </Text>{' '}
                for{' '}
                <Text style={{ fontWeight: '800', color: '#15803D' }}>
                  {pendingPulse.durationSec}s
                </Text>
                .{'\n\n'}
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
