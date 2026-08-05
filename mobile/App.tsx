import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { palette } from "./src/theme";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { PaperBackground } from "./src/components/PaperBackground";
import { TopBar, type ScreenName } from "./src/components/TopBar";
import { DrawerMenu } from "./src/components/DrawerMenu";
import { LocationProvider } from "./src/LocationContext";
import { SavedLocationsProvider } from "./src/SavedLocationsContext";
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

  const [active, setActive] = useState<ScreenName>("Domů");
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <PaperBackground>
          <LoadingScreen />
        </PaperBackground>
      </SafeAreaView>
    );
  }

  const ActiveScreen = SCREENS[active];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <PaperBackground>
        <TopBar onMenuPress={() => setDrawerOpen(true)} />
        <ActiveScreen />
        <SpeciesDetailSheet />
        <DrawerMenu
          visible={drawerOpen}
          active={active}
          onNavigate={(screen) => {
            setActive(screen);
            setDrawerOpen(false);
          }}
          onClose={() => setDrawerOpen(false)}
        />
      </PaperBackground>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocationProvider>
        <SavedLocationsProvider>
          <SpeciesDetailProvider>
            <AppShell />
          </SpeciesDetailProvider>
        </SavedLocationsProvider>
      </LocationProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
});
