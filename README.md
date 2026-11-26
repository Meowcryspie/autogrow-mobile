# Autogrow Mobile (iOS, Android & Expo Web)

Cross-platform React Native (Expo TypeScript) companion app mirroring the Autogrow Farm telemetry, EC/pH dosing, substrate root-zone, and safety alarm interface with hardened security controls.

## Security & Safety Controls Applied
- **TLS Enforcement:** Public internet Edge Server URLs require `https://` (`wss://`); `http://` is permitted strictly for private LAN / loopback testing (`localhost`, `192.168.x.x`, `10.x.x.x`). Embedded URL credentials are blocked.
- **Hardware Keychain/Keystore Credentials:** Operator bearer tokens use `expo-secure-store` on iOS/Android and remain strictly in volatile session memory on Web (never written to `localStorage`).
- **Two-Step Bounded Dosing Interlock:** Pump/valve triggers enforce an explicit actuator allowlist, clamped pulse durations (`1–30s`), `UUID` command IDs with `10s` expiration, an `Off` safety lockout mode, and a mandatory confirmation modal before execution.
- **Default Safe Demo Mode:** Runs locally simulated telemetry until explicitly paired with a validated endpoint.

## Running on Laptop & Phone
- **Phone (LAN / Tunnel):**
  ```bash
  npx expo start --tunnel
  ```
  Scan the QR code with **Expo Go** on iOS or Android.
- **Web Export:**
  ```bash
  npx expo export --platform web
  ```
