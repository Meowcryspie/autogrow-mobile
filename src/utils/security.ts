import type { ActuatorId } from '../types/telemetry';

export const ALLOWED_ACTUATORS: readonly ActuatorId[] = [
  'pump-nutrient-a',
  'pump-nutrient-b',
  'pump-acid',
  'valve-irrigation-1',
];

export function isAllowedActuator(id: string): id is ActuatorId {
  return (ALLOWED_ACTUATORS as readonly string[]).includes(id);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function clampDurationSeconds(seconds: number): number {
  return Math.round(clampNumber(seconds, 1, 30));
}

export function clampTargetEc(ec: number): number {
  return Number(clampNumber(ec, 0.6, 3.5).toFixed(1));
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '[::1]') {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  const match172 = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(lower);
  if (match172) {
    const second = Number(match172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export interface ValidatedEndpoint {
  valid: boolean;
  httpBaseUrl?: string;
  wsUrl?: string;
  isLocalLan?: boolean;
  error?: string;
}

/**
 * Enforces HTTPS/WSS for all public internet hosts, allowing HTTP/WS
 * strictly for private LAN / loopback addresses. Rejects embedded credentials.
 */
export function validateEdgeEndpoint(rawInput: string): ValidatedEndpoint {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a valid Edge Server URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL. Example: https://edge.myfarm.com' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs must not embed usernames or passwords.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Only HTTPS (recommended) or local LAN HTTP protocols are permitted.' };
  }

  const isLocalLan = isPrivateOrLoopbackHost(parsed.hostname);
  if (parsed.protocol === 'http:' && !isLocalLan) {
    return {
      valid: false,
      error: 'Unencrypted HTTP is blocked over public internet. Use https:// (e.g., Cloudflare Tunnel or TLS gateway).'
    };
  }

  const origin = parsed.origin;
  const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${parsed.host}/ws`;

  return {
    valid: true,
    httpBaseUrl: origin,
    wsUrl,
    isLocalLan,
  };
}

export function generateCommandUuid(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}
