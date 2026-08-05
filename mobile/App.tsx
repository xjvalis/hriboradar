import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { palette } from "./src/theme";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { TopBar, type ScreenName } from "./src/components/TopBar";
import { LocationProvider } from "./src/LocationContext";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import MojeScreen from "./src/screens/MojeScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const SCREENS: Record<ScreenName, React.ComponentType> = {
  Domů: HomeScreen,
  Mapa: MapScreen,
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

  const [active, setActive] = useState<ScreenName>("Domů");

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  const ActiveScreen = SCREENS[active];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <TopBar active={active} onNavigate={setActive} />
      <ActiveScreen />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocationProvider>
        <AppShell />
      </LocationProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
});
