import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, SafeAreaView } from "react-native";
import { colors } from "./src/theme";
import { MapIcon, HomeIcon, BookIcon, PinIcon } from "./src/icons";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import AtlasScreen from "./src/screens/AtlasScreen";
import PlacesScreen from "./src/screens/PlacesScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    "Fraunces-SemiBold": require("./assets/fonts/Fraunces-SemiBold.ttf"),
    "Fraunces-Bold": require("./assets/fonts/Fraunces-Bold.ttf"),
    "Nunito-Regular": require("./assets/fonts/Nunito-Regular.ttf"),
    "Nunito-Bold": require("./assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("./assets/fonts/Nunito-ExtraBold.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
          tabBarLabelStyle: { fontFamily: "Nunito-Bold", fontSize: 10.5 },
        }}
      >
        <Tab.Screen
          name="Mapa"
          component={MapScreen}
          options={{ tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Domů"
          component={HomeScreen}
          options={{ tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Atlas"
          component={AtlasScreen}
          options={{ tabBarIcon: ({ color, size }) => <BookIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Místa"
          component={PlacesScreen}
          options={{ tabBarIcon: ({ color, size }) => <PinIcon color={color} size={size} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
