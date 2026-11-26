export type ScreenTab = 'farms' | 'telemetry' | 'dosing' | 'substrate' | 'alarms' | 'pairing';

export type ActuatorId =
  | 'pump-nutrient-a'
  | 'pump-nutrient-b'
  | 'pump-acid'
  | 'valve-irrigation-1';

export type DosingMode = 'Auto' | 'Manual' | 'Off';

export type ConnectionMode = 'DEMO_SAFE' | 'CONNECTED' | 'CONNECTING' | 'OFFLINE';

export interface ActuatorState {
  status: 'IDLE' | 'ACTIVE' | 'LOCKOUT';
  remaining_seconds: number;
}

export interface AlarmEvent {
  alarm_id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  triggered_at: string;
}

export interface TelemetryMetrics {
  ec: number;
  ph: number;
  vpd: number;
  temp_air: number;
  temp_water: number;
  co2: number;
  vwc: number;
  rootzone_pore_ec: number;
}

export interface ZoneSetpoint {
  zone_id: string;
  target_ec: number;
  target_ph: number;
}
