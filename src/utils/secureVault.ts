import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_ENDPOINT = 'autogrow_secure_endpoint';
const KEY_TOKEN = 'autogrow_secure_bearer_token';

// Ephemeral in-memory fallback on Web so secrets are never written to browser localStorage
let webMemoryEndpoint = '';
let webMemoryToken = '';

export async function saveSecureConfig(endpoint: string, bearerToken: string): Promise<void> {
  if (Platform.OS === 'web') {
    webMemoryEndpoint = endpoint;
    webMemoryToken = bearerToken;
    return;
  }
  await SecureStore.setItemAsync(KEY_ENDPOINT, endpoint, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
  if (bearerToken) {
    await SecureStore.setItemAsync(KEY_TOKEN, bearerToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  } else {
    await SecureStore.deleteItemAsync(KEY_TOKEN);
  }
}

export async function loadSecureConfig(): Promise<{ endpoint: string; token: string }> {
  if (Platform.OS === 'web') {
    return { endpoint: webMemoryEndpoint, token: webMemoryToken };
  }
  const endpoint = (await SecureStore.getItemAsync(KEY_ENDPOINT)) || '';
  const token = (await SecureStore.getItemAsync(KEY_TOKEN)) || '';
  return { endpoint, token };
}

export async function clearSecureConfig(): Promise<void> {
  if (Platform.OS === 'web') {
    webMemoryEndpoint = '';
    webMemoryToken = '';
    return;
  }
  await SecureStore.deleteItemAsync(KEY_ENDPOINT);
  await SecureStore.deleteItemAsync(KEY_TOKEN);
}
