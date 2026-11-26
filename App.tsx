import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AutogrowMobileApp } from './src/screens/AutogrowMobileApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AutogrowMobileApp />
    </SafeAreaProvider>
  );
}
