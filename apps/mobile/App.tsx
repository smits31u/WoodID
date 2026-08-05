import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as ExpoSplashScreen from 'expo-splash-screen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ContributePhotoScreen from './src/screens/ContributePhotoScreen';
import SuggestSpeciesScreen from './src/screens/SuggestSpeciesScreen';
import AboutScreen from './src/screens/AboutScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import SplashScreen from './src/screens/SplashScreen';
import UpgradeScreen from './src/screens/UpgradeScreen';
import type { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme/colors';
import { processQueue } from './src/lib/offlineQueue';
import { configurePurchases } from './src/lib/purchases';

// Must be called at module scope, not inside the component — otherwise it may run too late,
// after the native splash has already auto-hidden.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    configurePurchases();
    processQueue();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        processQueue();
      }
    });

    // NetInfo's own listener can miss a connectivity change that happened while the app was
    // backgrounded (RN throttles/suspends JS then) — this catches that gap on resume.
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        processQueue();
      }
    });

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="ContributePhoto" component={ContributePhotoScreen} />
            <Stack.Screen name="SuggestSpecies" component={SuggestSpeciesScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen
              name="Upgrade"
              component={UpgradeScreen}
              options={{ presentation: 'modal' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
