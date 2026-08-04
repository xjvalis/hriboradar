import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { colors } from "./src/theme";
import { Header, type ScreenName } from "./src/Header";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import AtlasScreen from "./src/screens/AtlasScreen";
import PlacesScreen from "./src/screens/PlacesScreen";

const SCREENS: Record<ScreenName, React.ComponentType> = {
  Mapa: MapScreen,
  Domů: HomeScreen,
  Atlas: AtlasScreen,
  Místa: PlacesScreen,
};

export default function App() {
  const [fontsLoaded] = useFonts({
    "Fraunces-SemiBold": require("./assets/fonts/Fraunces-SemiBold.ttf"),
    "Fraunces-Bold": require("./assets/fonts/Fraunces-Bold.ttf"),
    "Nunito-Regular": require("./assets/fonts/Nunito-Regular.ttf"),
    "Nunito-Bold": require("./assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("./assets/fonts/Nunito-ExtraBold.ttf"),
  });

  const [active, setActive] = useState<ScreenName>("Domů");

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  }

  const ActiveScreen = SCREENS[active];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Header active={active} onNavigate={setActive} />
      <ActiveScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
