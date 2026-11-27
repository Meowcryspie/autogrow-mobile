import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  ActuatorId,
  ActuatorState,
  AlarmEvent,
  AttachedController,
  AttachedSensor,
  ConnectionMode,
  ControllerModel,
  FacilityNode,
  FacilityType,
  FarmEstate,
  SensorType,
  TelemetryMetrics,
  ZoneSetpoint,
} from '../types/telemetry';
import { INITIAL_FARMS_DATA, SENSOR_SPECS } from '../data/farmsSeed';
import {
  clampDurationSeconds,
  generateCommandUuid,
  isAllowedActuator,
  validateEdgeEndpoint,
} from '../utils/security';
import { clearSecureConfig, loadSecureConfig, saveSecureConfig } from '../utils/secureVault';

export interface AddFarmInput {
  name: string;
  location: string;
  crop: string;
  template: 'starter' | 'minimal';
  starterFacilityName?: string;
}

export interface AddFacilityInput {
  name: string;
  type: FacilityType;
  crop: string;
  zone?: string;
}

export interface LinkControllerInput {
  farmId: string;
  facilityId: string;
  model: ControllerModel;
  serial: string;
  endpointUrl: string;
  token: string;
}

function deriveControllerMetrics(
  facility: FacilityNode,
  controller: AttachedController
): TelemetryMetrics {
  const findVal = (type: SensorType, fallback: number) => {
    const match = controller.sensors.find((s) => s.type === type);
    return match ? match.value : fallback;
  };
  const ec = findVal('ec', facility.metrics.ec || 1.85);
  return {
    ec,
    ph: findVal('ph', facility.metrics.ph || 5.85),
    vpd: findVal('vpd', facility.metrics.vpd || 1.15),
    temp_air: controller.model === 'IntelliClimate Pro' ? 23.1 : 22.4,
    temp_water: findVal('temp', facility.metrics.waterTemp || 20.8),
    co2: findVal('co2', 780),
    vwc: findVal('vwc', facility.metrics.vwc || 64.5),
    rootzone_pore_ec: Number((ec + 0.25).toFixed(2)),
  };
}

export function useMobileTelemetry() {
  const [farms, setFarms] = useState<FarmEstate[]>(INITIAL_FARMS_DATA);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(INITIAL_FARMS_DATA[0].id);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    INITIAL_FARMS_DATA[0].facilities[0].id
  );
  const [selectedControllerId, setSelectedControllerId] = useState<string>(
    INITIAL_FARMS_DATA[0].facilities[0].controllers[0].id
  );

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || farms[0],
    [farms, selectedFarmId]
  );

  const selectedFacility = useMemo(
    () =>
      selectedFarm.facilities.find((fac) => fac.id === selectedFacilityId) ||
      selectedFarm.facilities[0],
    [selectedFarm, selectedFacilityId]
  );

  const selectedController = useMemo(
    () =>
      selectedFacility.controllers.find((c) => c.id === selectedControllerId) ||
      selectedFacility.controllers[0],
    [selectedFacility, selectedControllerId]
  );

  const [metricsOverride, setMetricsOverride] = useState<TelemetryMetrics | null>(null);
  const [actuators, setActuators] = useState<Record<string, ActuatorState>>({});
  const [activeAlarms, setActiveAlarms] = useState<AlarmEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('DEMO_SAFE');
  const [endpointUrl, setEndpointUrl] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);

  const baseControllerMetrics = useMemo(
    () => deriveControllerMetrics(selectedFacility, selectedController),
    [selectedFacility, selectedController]
  );

  // Clear live drift override whenever the operator picks a different controller
  useEffect(() => {
    setMetricsOverride(null);
  }, [selectedController.id, selectedFacility.id, selectedFarm.id]);

  const metrics = metricsOverride || baseControllerMetrics;

  const setpoint: ZoneSetpoint = useMemo(
    () => ({
      zone_id: selectedFacility.zone || selectedFacility.id,
      target_ec: selectedFacility.metrics.targetEc || 1.8,
      target_ph: selectedFacility.metrics.targetPh || 5.8,
    }),
    [selectedFacility]
  );

  const wsRef = useRef<WebSocket | null>(null);
  const bearerRef = useRef<string>('');
  const validatedHttpRef = useRef<string>('');

  const stopWs = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore close failure
      }
      wsRef.current = null;
    }
  };

  const selectFarm = useCallback(
    (farmId: string) => {
      const targetFarm = farms.find((f) => f.id === farmId);
      if (!targetFarm) return;
      setSelectedFarmId(targetFarm.id);
      const firstFac = targetFarm.facilities[0];
      if (firstFac) {
        setSelectedFacilityId(firstFac.id);
        if (firstFac.controllers[0]) {
          setSelectedControllerId(firstFac.controllers[0].id);
        }
      }
    },
    [farms]
  );

  const selectFacility = useCallback(
    (facilityId: string) => {
      const targetFac = selectedFarm.facilities.find((f) => f.id === facilityId);
      if (!targetFac) return;
      setSelectedFacilityId(targetFac.id);
      if (targetFac.controllers[0]) {
        setSelectedControllerId(targetFac.controllers[0].id);
      }
    },
    [selectedFarm]
  );

  const selectController = useCallback((controllerId: string) => {
    setSelectedControllerId(controllerId);
  }, []);

  const addFarm = useCallback(
    (input: AddFarmInput): { ok: true; farmId: string } | { ok: false; error: string } => {
      const cleanName = input.name.trim();
      const cleanLocation = input.location.trim();
      const cleanCrop = input.crop.trim();

      if (cleanName.length < 3) {
        return { ok: false, error: 'Enter a Farm / Place name (at least 3 characters).' };
      }
      if (!cleanLocation) {
        return { ok: false, error: 'Enter the Farm location or address.' };
      }
      if (!cleanCrop) {
        return { ok: false, error: 'Enter the primary crop or growing zone focus.' };
      }
      if (farms.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
        return { ok: false, error: 'A farm with this name already exists.' };
      }

      const idSuffix = Date.now().toString().slice(-4);
      const facilityName = input.starterFacilityName?.trim() || 'Venlo Bay 01 · Main Facility';
      const baseSlug = cleanName.split(' ')[0].replace(/[^A-Za-z0-9]/g, '') || 'Autogrow';

      const starterFac: FacilityNode = {
        id: `fac-${idSuffix}-1`,
        name: facilityName,
        type: input.template === 'starter' ? 'greenhouse' : 'headhouse',
        zone: 'Zone 01',
        crop: cleanCrop,
        metrics: {
          ec: 1.9,
          targetEc: 1.9,
          ph: 5.85,
          targetPh: 5.85,
          vpd: 1.05,
          vwc: 65.0,
          waterTemp: 20.4,
        },
        controllers: [
          {
            id: `EM-${idSuffix}-NZ`,
            model: input.template === 'starter' ? 'MultiGrow MGC-Pro 16-Ch' : 'Autogrow EC Mini',
            serial: `EM-${idSuffix}-NZ`,
            firmware: 'v5.0-Rev3',
            wifiSSID: `${baseSlug}_SCADA`,
            rssi: -48,
            ipAddress: '192.168.50.21',
            status: 'ONLINE',
            doseCountHour: 14,
            doseCountTotal: 80,
            linkMode: 'DEMO_SAFE',
            sensors: [
              {
                id: `sens-${idSuffix}-ec`,
                name: 'EC Substrate Probe',
                type: 'ec',
                value: 1.9,
                unit: 'mS/cm',
                pin: 'AN-01',
                status: 'NORMAL',
              },
              {
                id: `sens-${idSuffix}-ph`,
                name: 'Glass pH Electrode',
                type: 'ph',
                value: 5.85,
                unit: 'pH',
                pin: 'AN-02',
                status: 'NORMAL',
              },
              {
                id: `sens-${idSuffix}-vpd`,
                name: 'Air Temp & VPD Sensor',
                type: 'vpd',
                value: 1.05,
                unit: 'kPa',
                pin: 'I2C-1',
                status: 'NORMAL',
              },
              {
                id: `sens-${idSuffix}-vwc`,
                name: 'Substrate VWC% Moisture',
                type: 'vwc',
                value: 65.0,
                unit: '%',
                pin: 'AN-03',
                status: 'NORMAL',
              },
            ],
          },
        ],
      };

      const newFarm: FarmEstate = {
        id: `farm-${idSuffix}`,
        name: cleanName,
        location: cleanLocation,
        tag: 'Field SCADA Estate',
        crop: cleanCrop,
        visualKind: 'glasshouse',
        isActive: true,
        facilities: [starterFac],
      };

      setFarms((prev) => [newFarm, ...prev]);
      setSelectedFarmId(newFarm.id);
      setSelectedFacilityId(starterFac.id);
      setSelectedControllerId(starterFac.controllers[0].id);
      return { ok: true, farmId: newFarm.id };
    },
    [farms]
  );

  const addFacility = useCallback(
    (
      farmId: string,
      input: AddFacilityInput
    ): { ok: true; facilityId: string } | { ok: false; error: string } => {
      const cleanName = input.name.trim();
      const cleanCrop = input.crop.trim() || 'Hydroponic Greens';
      if (cleanName.length < 2) {
        return { ok: false, error: 'Enter a facility name (at least 2 characters).' };
      }

      const idSuffix = Date.now().toString().slice(-4);
      const ctrlSerial = `EM-${idSuffix}-MY`;
      const newFacility: FacilityNode = {
        id: `fac-${idSuffix}`,
        name: cleanName,
        type: input.type,
        zone: input.zone?.trim() || 'New Bay',
        crop: cleanCrop,
        metrics: {
          ec: 1.85,
          targetEc: 1.85,
          ph: 5.82,
          targetPh: 5.8,
          vpd: 1.1,
          vwc: 66.0,
          waterTemp: 20.5,
        },
        controllers: [
          {
            id: ctrlSerial,
            model: 'Autogrow EC Mini',
            serial: ctrlSerial,
            firmware: 'v5.0-Rev3',
            wifiSSID: 'Autogrow_Edge_WiFi',
            rssi: -50,
            ipAddress: '192.168.50.30',
            status: 'ONLINE',
            doseCountHour: 10,
            doseCountTotal: 40,
            linkMode: 'DEMO_SAFE',
            sensors: [
              {
                id: `${idSuffix}-ec`,
                name: 'EC Substrate Probe',
                type: 'ec',
                value: 1.85,
                unit: 'mS/cm',
                pin: 'AN-01',
                status: 'NORMAL',
              },
              {
                id: `${idSuffix}-ph`,
                name: 'Glass pH Electrode',
                type: 'ph',
                value: 5.82,
                unit: 'pH',
                pin: 'AN-02',
                status: 'NORMAL',
              },
            ],
          },
        ],
      };

      setFarms((prev) =>
        prev.map((farm) =>
          farm.id === farmId ? { ...farm, facilities: [...farm.facilities, newFacility] } : farm
        )
      );
      setSelectedFarmId(farmId);
      setSelectedFacilityId(newFacility.id);
      setSelectedControllerId(ctrlSerial);
      return { ok: true, facilityId: newFacility.id };
    },
    []
  );

  // Connect either to secure live endpoint or safe simulated demo stream
  const connectWithConfig = useCallback((rawEndpoint: string, token: string) => {
    stopWs();
    bearerRef.current = token;
    setHasToken(Boolean(token));

    if (!rawEndpoint.trim()) {
      validatedHttpRef.current = '';
      setEndpointUrl('');
      setConnectionMode('DEMO_SAFE');
      return { ok: true as const };
    }

    const check = validateEdgeEndpoint(rawEndpoint);
    if (!check.valid || !check.httpBaseUrl || !check.wsUrl) {
      setConnectionMode('OFFLINE');
      return { ok: false as const, error: check.error || 'Invalid endpoint' };
    }

    validatedHttpRef.current = check.httpBaseUrl;
    setEndpointUrl(check.httpBaseUrl);
    setConnectionMode('CONNECTING');

    try {
      const ws = new WebSocket(check.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionMode('CONNECTED');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (data && data.type === 'TELEMETRY_TICK' && data.metrics) {
            setMetricsOverride((prev) => {
              const base = prev || {
                ec: 1.85,
                ph: 5.85,
                vpd: 1.15,
                temp_air: 22.4,
                temp_water: 21.4,
                co2: 780,
                vwc: 64.5,
                rootzone_pore_ec: 2.1,
              };
              return {
                ec: typeof data.metrics.ec === 'number' ? data.metrics.ec : base.ec,
                ph: typeof data.metrics.ph === 'number' ? data.metrics.ph : base.ph,
                vpd: typeof data.metrics.vpd === 'number' ? data.metrics.vpd : base.vpd,
                temp_air:
                  typeof data.metrics.temp_air === 'number'
                    ? data.metrics.temp_air
                    : base.temp_air,
                temp_water:
                  typeof data.metrics.temp_water === 'number'
                    ? data.metrics.temp_water
                    : base.temp_water,
                co2: typeof data.metrics.co2 === 'number' ? data.metrics.co2 : base.co2,
                vwc: typeof data.metrics.vwc === 'number' ? data.metrics.vwc : base.vwc,
                rootzone_pore_ec:
                  typeof data.metrics.rootzone_pore_ec === 'number'
                    ? data.metrics.rootzone_pore_ec
                    : base.rootzone_pore_ec,
              };
            });
            if (data.actuators) setActuators(data.actuators);
            if (Array.isArray(data.active_alarms)) setActiveAlarms(data.active_alarms);
          }
        } catch {
          // ignore malformed telemetry frames
        }
      };

      ws.onerror = () => {
        setConnectionMode('OFFLINE');
      };

      ws.onclose = () => {
        setConnectionMode((curr) => (curr === 'DEMO_SAFE' ? 'DEMO_SAFE' : 'OFFLINE'));
      };

      return { ok: true as const };
    } catch {
      setConnectionMode('OFFLINE');
      return { ok: false as const, error: 'Unable to open WebSocket connection.' };
    }
  }, []);

  // Load saved config from SecureStore (native Keychain/Keystore) on startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await loadSecureConfig();
        if (!mounted) return;
        if (saved.endpoint) {
          connectWithConfig(saved.endpoint, saved.token);
        }
      } catch {
        // stay safely in DEMO_SAFE mode
      }
    })();
    return () => {
      mounted = false;
      stopWs();
    };
  }, [connectWithConfig]);

  // Safe simulation micro-drift for the currently inspected controller
  useEffect(() => {
    if (connectionMode !== 'DEMO_SAFE') return;
    const interval = setInterval(() => {
      setMetricsOverride((prev) => {
        const base = prev || baseControllerMetrics;
        const nextEc = Number(
          Math.max(0.0, Math.min(3.5, base.ec + (Math.random() * 0.04 - 0.02))).toFixed(2)
        );
        const nextPh = Number(
          Math.max(5.0, Math.min(7.5, base.ph + (Math.random() * 0.02 - 0.01))).toFixed(2)
        );
        const nextTemp = Number((base.temp_air + (Math.random() * 0.2 - 0.1)).toFixed(1));
        return {
          ...base,
          ec: nextEc,
          ph: nextPh,
          temp_air: nextTemp,
          co2: Math.round(base.co2 + (Math.random() * 14 - 7)),
          vwc: Number(Math.max(0, Math.min(95, base.vwc + (Math.random() * 0.4 - 0.2))).toFixed(1)),
          rootzone_pore_ec: Number((nextEc + 0.25).toFixed(2)),
        };
      });
    }, 2400);
    return () => clearInterval(interval);
  }, [connectionMode, baseControllerMetrics]);

  // Bounded 1s countdown ticker for locally simulated actuator pulses
  useEffect(() => {
    const timer = setInterval(() => {
      setActuators((prev) => {
        let changed = false;
        const next: Record<string, ActuatorState> = {};
        for (const [k, st] of Object.entries(prev)) {
          if (st.status === 'ACTIVE' && st.remaining_seconds > 1) {
            changed = true;
            next[k] = { status: 'ACTIVE', remaining_seconds: st.remaining_seconds - 1 };
          } else if (st.status === 'ACTIVE' && st.remaining_seconds <= 1) {
            changed = true;
            next[k] = { status: 'IDLE', remaining_seconds: 0 };
          } else {
            next[k] = st;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const linkControllerDevice = async (input: LinkControllerInput) => {
    const cleanSerial = input.serial.trim().toUpperCase();
    if (cleanSerial.length < 3) {
      return { ok: false as const, error: 'Enter a valid controller serial / device ID.' };
    }

    const res = connectWithConfig(input.endpointUrl, input.token);
    if (!res.ok) {
      return res;
    }

    await saveSecureConfig(input.endpointUrl.trim(), input.token.trim());

    const linkMode = input.endpointUrl.trim() ? 'EDGE_TLS' : 'DEMO_SAFE';
    const newId = `${cleanSerial}-${Date.now().toString().slice(-3)}`;

    setFarms((prev) =>
      prev.map((farm) => {
        if (farm.id !== input.farmId) return farm;
        return {
          ...farm,
          facilities: farm.facilities.map((fac) => {
            if (fac.id !== input.facilityId) return fac;
            const existing = fac.controllers.find(
              (c) => c.serial.toUpperCase() === cleanSerial
            );
            if (existing) {
              return {
                ...fac,
                controllers: fac.controllers.map((c) =>
                  c.id === existing.id
                    ? { ...c, model: input.model, linkMode, status: 'ONLINE' }
                    : c
                ),
              };
            }
            const newCtrl: AttachedController = {
              id: newId,
              model: input.model,
              serial: cleanSerial,
              firmware: 'v5.0-Rev3',
              wifiSSID: 'Autogrow_Edge_WiFi',
              rssi: -46,
              ipAddress: `192.168.10.${60 + fac.controllers.length}`,
              status: 'ONLINE',
              doseCountHour: 0,
              doseCountTotal: 0,
              linkMode,
              sensors: [
                {
                  id: `${newId}-s1`,
                  name: 'EC Substrate Probe',
                  type: 'ec',
                  value: fac.metrics.ec || 2.0,
                  unit: 'mS/cm',
                  pin: 'AN-01',
                  status: 'NORMAL',
                },
                {
                  id: `${newId}-s2`,
                  name: 'Glass pH Electrode',
                  type: 'ph',
                  value: fac.metrics.ph || 5.8,
                  unit: 'pH',
                  pin: 'AN-02',
                  status: 'NORMAL',
                },
                {
                  id: `${newId}-s3`,
                  name: 'Air Temp & VPD Sensor',
                  type: 'vpd',
                  value: fac.metrics.vpd || 1.1,
                  unit: 'kPa',
                  pin: 'I2C-1',
                  status: 'NORMAL',
                },
              ],
            };
            return {
              ...fac,
              controllers: [...fac.controllers, newCtrl],
            };
          }),
        };
      })
    );

    setSelectedFarmId(input.farmId);
    setSelectedFacilityId(input.facilityId);
    const targetFarm = farms.find((f) => f.id === input.farmId);
    const targetFac = targetFarm?.facilities.find((fac) => fac.id === input.facilityId);
    const matchedExisting = targetFac?.controllers.find(
      (c) => c.serial.toUpperCase() === cleanSerial
    );
    setSelectedControllerId(matchedExisting ? matchedExisting.id : newId);

    return { ok: true as const, controllerId: matchedExisting ? matchedExisting.id : newId };
  };

  const attachSensorToController = (
    farmId: string,
    facilityId: string,
    controllerId: string,
    sensorType: SensorType
  ) => {
    const spec = SENSOR_SPECS[sensorType];
    setFarms((prev) =>
      prev.map((farm) => {
        if (farm.id !== farmId) return farm;
        return {
          ...farm,
          facilities: farm.facilities.map((fac) => {
            if (fac.id !== facilityId) return fac;
            return {
              ...fac,
              controllers: fac.controllers.map((ctrl) => {
                if (ctrl.id !== controllerId) return ctrl;
                const nextIdx = ctrl.sensors.length + 1;
                const newSensor: AttachedSensor = {
                  id: `sens-${Date.now().toString().slice(-4)}-${nextIdx}`,
                  name: spec.name,
                  type: sensorType,
                  value: spec.defaultVal,
                  unit: spec.unit,
                  pin: `${spec.pin}-${nextIdx}`,
                  status: 'NORMAL',
                };
                return { ...ctrl, sensors: [...ctrl.sensors, newSensor] };
              }),
            };
          }),
        };
      })
    );
  };

  const resetToDemoMode = async () => {
    await clearSecureConfig();
    connectWithConfig('', '');
  };

  const triggerActuatorPulse = async (
    actuatorId: ActuatorId,
    requestedSeconds: number
  ): Promise<boolean> => {
    if (!isAllowedActuator(actuatorId)) {
      return false;
    }
    const safeSeconds = clampDurationSeconds(requestedSeconds);

    // Local safe simulation feedback when no physical controller is connected
    if (connectionMode === 'DEMO_SAFE' || !validatedHttpRef.current) {
      setActuators((prev) => ({
        ...prev,
        [actuatorId]: { status: 'ACTIVE', remaining_seconds: safeSeconds },
      }));
      return true;
    }

    const now = Date.now();
    const payload = {
      command_id: generateCommandUuid(),
      farm_id: selectedFarm.id,
      zone_id: selectedFacility.zone || selectedFacility.id,
      controller_serial: selectedController.serial,
      actuator_id: actuatorId,
      action: 'RUN_TIMED',
      duration_sec: safeSeconds,
      issued_by: 'autogrow-mobile-operator',
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + 10000).toISOString(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (bearerRef.current) {
        headers.Authorization = `Bearer ${bearerRef.current}`;
      }
      const res = await fetch(`${validatedHttpRef.current}/api/commands`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (res.ok) {
        setActuators((prev) => ({
          ...prev,
          [actuatorId]: { status: 'ACTIVE', remaining_seconds: safeSeconds },
        }));
      }
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const acknowledgeAlarm = async (alarmId: string) => {
    setActiveAlarms((prev) => prev.filter((a) => a.alarm_id !== alarmId));
    if (connectionMode === 'DEMO_SAFE' || !validatedHttpRef.current) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const headers: Record<string, string> = {};
      if (bearerRef.current) {
        headers.Authorization = `Bearer ${bearerRef.current}`;
      }
      await fetch(`${validatedHttpRef.current}/api/alarms/${encodeURIComponent(alarmId)}/ack`, {
        method: 'POST',
        headers,
        signal: controller.signal,
      });
    } catch {
      // alarm already acknowledged optimistically
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
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
  };
}
