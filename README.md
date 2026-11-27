# Autogrow Mobile (iOS, Android & Expo Web)

Cross-platform React Native (Expo TypeScript) companion app mirroring the Autogrow Farm telemetry, EC/pH dosing, substrate root-zone, and safety alarm interface with hardened security controls and OTA updates (`expo-updates`).

---

## Expo Free Tier Limits & Best Practices (Reminder)
Expo Free Plan (**$0/month**) limits apply **per Expo account** (`meowcryspie`), not per phone install:
- **15 Android + 15 iOS cloud builds / month:** Only consumed when compiling a new `.apk` / `.aab` / `.ipa` installer file via `eas build`. Installing the `.apk` on hundreds of phones uses only **1 build**.
- **1,000 Monthly Active Users (MAUs) / month:** Counts unique phone installations that download an OTA update (`eas update`). Downloading 20 OTA patches on 1 phone in the same month = **1 MAU**.
- **100 GiB/month CDN bandwidth + 20 GiB storage:** Unlimited `eas update` code/UI publishes within bandwidth/storage limits.
- **No overage charges:** On the Free plan, updates simply pause until next month if a quota is ever reached; already-installed apps keep running normally.

### How to Avoid Hitting Limits
1. **Develop & test UI on your laptop first (`0` builds, `0` MAUs):** Use `npx expo start --tunnel ngrok` (Expo Go) or `npm run build:web`.
2. **Always typecheck before cloud builds:** `build:apk` runs `npx tsc --noEmit` first so a typo never wastes one of your 15 monthly build slots.
3. **Ship UI/logic fixes via OTA (`npm run ota:preview`), NOT new APKs:** Installed OTA-enabled `.apk` users get fixes automatically from Expo Cloud CDN (`u.expo.dev`) without Expo Go and without downloading a new `.apk`.
4. **Only run `build:apk` when native code/config changes:** App icon, permissions, `app.json` native config, or adding new native SDK plugins (Bluetooth, Camera, etc.).
5. **Keep `preview` vs `production` separate:** Test OTA updates with your team on `--channel preview` before pushing to `--channel production`.

---

## Security & Safety Controls Applied
- **TLS Enforcement:** Public internet Edge Server URLs require `https://` (`wss://`); `http://` is permitted strictly for private LAN / loopback (`localhost`, `192.168.x.x`, `10.x.x.x`). Embedded URL credentials are blocked.
- **Hardware Keychain/Keystore Credentials:** Operator bearer tokens use `expo-secure-store` on iOS/Android and remain strictly in volatile session memory on Web (never written to `localStorage`).
- **Two-Step Bounded Dosing Interlock:** Pump/valve triggers enforce an explicit actuator allowlist, clamped pulse durations (`1–30s`), `UUID` command IDs with `10s` expiration, an `Off` safety lockout mode, and a mandatory confirmation modal before execution.

---

## Commands
```bash
# 1. Local dev on your phone (Expo Go)
npx expo start --tunnel ngrok

# 2. Typecheck + Publish Over-The-Air (OTA) update to Preview APK users (uses 0 builds)
npm run ota:preview

# 3. Typecheck + Build a new OTA-enabled Android APK in Expo Cloud (uses 1 build slot)
npm run build:apk

# 4. Build Web/Browser bundle for GitHub Pages
npm run build:web
```
