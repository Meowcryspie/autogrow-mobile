export type ScreenTab =
  | 'farms'
  | 'facilities'
  | 'controllers'
  | 'telemetry'
  | 'dosing'
  | 'substrate'
  | 'alarms'
  | 'add_farm'
  | 'pairing';

export type ActuatorId =
  | 'pump-nutrient-a'
  | 'pump-nutrient-b'
  | 'pump-acid'
  | 'valve-irrigation-1';

export type DosingMode = 'Auto' | 'Manual' | 'Off';

export type ConnectionMode = 'DEMO_SAFE' | 'CONNECTED' | 'CONNECTING' | 'OFFLINE';

export type FacilityType =
  | 'greenhouse'
  | 'polyhouse'
  | 'beds'
  | 'silos'
  | 'water_tank'
  | 'headhouse'
  | 'controller_station';

export type ControllerModel =
  | 'Autogrow EC Mini'
  | 'MultiGrow MGC-Pro 16-Ch'
  | 'IntelliDose Hub'
  | 'IntelliClimate Pro';

export type SensorType = 'ec' | 'ph' | 'vpd' | 'vwc' | 'temp' | 'co2' | 'par';

export interface AttachedSensor {
  id: string;
  name: string;
  type: SensorType;
  value: number;
  unit: string;
  pin: string;
  status: 'NORMAL' | 'ALERT' | 'CALIBRATING';
}

export interface AttachedController {
  id: string;
  model: ControllerModel;
  serial: string;
  firmware: string;
  wifiSSID: string;
  rssi: number;
  ipAddress: string;
  status: 'ONLINE' | 'DOSING' | 'ATTENTION';
  doseCountHour: number;
  doseCountTotal: number;
  linkMode: 'DEMO_SAFE' | 'EDGE_TLS';
  sensors: AttachedSensor[];
}

export interface FacilityMetrics {
  ec: number;
  targetEc: number;
  ph: number;
  targetPh: number;
  vpd: number;
  vwc: number;
  waterTemp: number;
}

export interface FacilityNode {
  id: string;
  name: string;
  type: FacilityType;
  zone: string;
  crop: string;
  metrics: FacilityMetrics;
  controllers: AttachedController[];
}

export interface FarmEstate {
  id: string;
  name: string;
  location: string;
  tag: string;
  crop: string;
  visualKind: 'glasshouse' | 'polybay';
  isActive: boolean;
  facilities: FacilityNode[];
}

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
  farm_name?: string;
  controller_serial?: string;
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
