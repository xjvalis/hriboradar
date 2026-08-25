import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { palette } from "./src/theme";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { TopBar, type ScreenName } from "./src/components/TopBar";
import { DrawerMenu } from "./src/components/DrawerMenu";
import { AppNavigationProvider, useAppNavigation } from "./src/AppNavigationContext";
import { LocationProvider } from "./src/LocationContext";
import { SavedLocationsProvider } from "./src/SavedLocationsContext";
import { AuthProvider, useAuth } from "./src/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import NewPasswordScreen from "./src/screens/NewPasswordScreen";
import { NotificationProvider } from "./src/NotificationContext";
import { useNotificationGenerator } from "./src/useNotificationGenerator";
import { NotificationsSheet } from "./src/components/NotificationsSheet";
import { LocationPickerProvider } from "./src/LocationPickerContext";
import { LocationPickerSheet } from "./src/components/LocationPickerSheet";
import { SpeciesDetailProvider } from "./src/SpeciesDetailContext";
import { SpeciesDetailSheet } from "./src/components/SpeciesDetailSheet";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import PredpovedScreen from "./src/screens/PredpovedScreen";
import HoubyScreen from "./src/screens/HoubyScreen";
import MojeScreen from "./src/screens/MojeScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const SCREENS: Record<ScreenName, React.ComponentType> = {
  Domů: HomeScreen,
  Mapa: MapScreen,
  Předpověď: PredpovedScreen,
  Houby: HoubyScreen,
  Moje: MojeScreen,
  Nastavení: SettingsScreen,
};

function AppShell() {
  const [fontsLoaded] = useFonts({
    "Fraunces-SemiBold": require("./assets/fonts/Fraunces-SemiBold.ttf"),
    "Fraunces-Bold": require("./assets/fonts/Fraunces-Bold.ttf"),
    "Manrope-Regular": require("./assets/fonts/Manrope-Regular.ttf"),
    "Manrope-Medium": require("./assets/fonts/Manrope-Medium.ttf"),
    "Manrope-SemiBold": require("./assets/fonts/Manrope-SemiBold.ttf"),
    "Manrope-Bold": require("./assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("./assets/fonts/Manrope-ExtraBold.ttf"),
  });

  const { active, setActive } = useAppNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, loading: authLoading, passwordRecovery } = useAuth();
  useNotificationGenerator();

  if (!fontsLoaded || authLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  // Checked before the normal !user branch below - a password-recovery
  // link does hand back a real session, but the standard flow is "set a
  // new password first," not "drop straight into the app."
  if (passwordRecovery) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <NewPasswordScreen />
      </SafeAreaView>
    );
  }

  // Gate everything behind login - nothing past this point renders for an
  // unauthenticated visitor. LoginScreen itself needs fonts loaded too
  // (Fraunces/Manrope), which is why this check comes after the fonts
  // branch above, not before it.
  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <LoginScreen />
      </SafeAreaView>
    );
  }

  const ActiveScreen = SCREENS[active];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <TopBar onMenuPress={() => setDrawerOpen(true)} />
      <ActiveScreen />
      <SpeciesDetailSheet />
      <NotificationsSheet />
      <LocationPickerSheet />
      <DrawerMenu
        visible={drawerOpen}
        active={active}
        onNavigate={(screen) => {
          setActive(screen);
          setDrawerOpen(false);
        }}
        onClose={() => setDrawerOpen(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <SavedLocationsProvider>
            <NotificationProvider>
              <LocationPickerProvider>
                <SpeciesDetailProvider>
                  <AppNavigationProvider>
                    <AppShell />
                  </AppNavigationProvider>
                </SpeciesDetailProvider>
              </LocationPickerProvider>
            </NotificationProvider>
          </SavedLocationsProvider>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
});
