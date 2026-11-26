import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ActuatorId,
  ActuatorState,
  AlarmEvent,
  ConnectionMode,
  TelemetryMetrics,
  ZoneSetpoint,
} from '../types/telemetry';
import {
  clampDurationSeconds,
  generateCommandUuid,
  isAllowedActuator,
  validateEdgeEndpoint,
} from '../utils/security';
import { clearSecureConfig, loadSecureConfig, saveSecureConfig } from '../utils/secureVault';

const DEFAULT_METRICS: TelemetryMetrics = {
  ec: 1.85,
  ph: 5.85,
  vpd: 1.15,
  temp_air: 22.4,
  temp_water: 21.4,
  co2: 780,
  vwc: 64.5,
  rootzone_pore_ec: 2.10,
};

export function useMobileTelemetry() {
  const [metrics, setMetrics] = useState<TelemetryMetrics>(DEFAULT_METRICS);
  const [actuators, setActuators] = useState<Record<string, ActuatorState>>({});
  const [activeAlarms, setActiveAlarms] = useState<AlarmEvent[]>([]);
  const [setpoint, setSetpoint] = useState<ZoneSetpoint>({
    zone_id: 'zone-1',
    target_ec: 1.8,
    target_ph: 5.8,
  });
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('DEMO_SAFE');
  const [endpointUrl, setEndpointUrl] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);

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
            setMetrics((prev) => ({
              ec: typeof data.metrics.ec === 'number' ? data.metrics.ec : prev.ec,
              ph: typeof data.metrics.ph === 'number' ? data.metrics.ph : prev.ph,
              vpd: typeof data.metrics.vpd === 'number' ? data.metrics.vpd : prev.vpd,
              temp_air: typeof data.metrics.temp_air === 'number' ? data.metrics.temp_air : prev.temp_air,
              temp_water: typeof data.metrics.temp_water === 'number' ? data.metrics.temp_water : prev.temp_water,
              co2: typeof data.metrics.co2 === 'number' ? data.metrics.co2 : prev.co2,
              vwc: typeof data.metrics.vwc === 'number' ? data.metrics.vwc : prev.vwc,
              rootzone_pore_ec:
                typeof data.metrics.rootzone_pore_ec === 'number'
                  ? data.metrics.rootzone_pore_ec
                  : prev.rootzone_pore_ec,
            }));
            if (data.actuators) setActuators(data.actuators);
            if (Array.isArray(data.active_alarms)) setActiveAlarms(data.active_alarms);
            if (data.setpoint) setSetpoint(data.setpoint);
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

  // Safe simulation tick when in DEMO_SAFE mode
  useEffect(() => {
    if (connectionMode !== 'DEMO_SAFE') return;
    const interval = setInterval(() => {
      setMetrics((prev) => {
        const nextEc = Number(Math.max(1.4, Math.min(2.4, prev.ec + (Math.random() * 0.04 - 0.02))).toFixed(2));
        const nextPh = Number(Math.max(5.6, Math.min(6.2, prev.ph + (Math.random() * 0.02 - 0.01))).toFixed(2));
        const nextTemp = Number((prev.temp_air + (Math.random() * 0.2 - 0.1)).toFixed(1));
        return {
          ...prev,
          ec: nextEc,
          ph: nextPh,
          temp_air: nextTemp,
          co2: Math.round(760 + Math.random() * 35),
          vwc: Number((64.2 + Math.random() * 0.6).toFixed(1)),
        };
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [connectionMode]);

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

  const configureConnection = async (rawEndpoint: string, token: string) => {
    const res = connectWithConfig(rawEndpoint, token);
    if (res.ok) {
      await saveSecureConfig(rawEndpoint.trim(), token.trim());
    }
    return res;
  };

  const resetToDemoMode = async () => {
    await clearSecureConfig();
    connectWithConfig('', '');
  };

  const triggerActuatorPulse = async (actuatorId: ActuatorId, requestedSeconds: number): Promise<boolean> => {
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
      farm_id: 'farm-akl-001',
      zone_id: setpoint.zone_id || 'zone-1',
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
    if (!validatedHttpRef.current) return;

    try {
      const headers: Record<string, string> = {};
      if (bearerRef.current) {
        headers.Authorization = `Bearer ${bearerRef.current}`;
      }
      await fetch(`${validatedHttpRef.current}/api/alarms/${encodeURIComponent(alarmId)}/ack`, {
        method: 'POST',
        headers,
      });
    } catch {
      // handled gracefully
    }
  };

  return {
    metrics,
    actuators,
    activeAlarms,
    setpoint,
    setSetpoint,
    connectionMode,
    endpointUrl,
    hasToken,
    configureConnection,
    resetToDemoMode,
    triggerActuatorPulse,
    acknowledgeAlarm,
  };
}
