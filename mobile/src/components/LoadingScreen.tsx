import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";
import { MorelLogo } from "./MorelLogo";
import { LoadingProgress } from "./LoadingProgress";

const STEPS = [
  "Stahuji data o počasí…",
  "Hledám lesy v okolí…",
  "Kontroluji vlhkost půdy…",
  "Ptám se, kdy naposledy pršelo…",
  "Počítám pravděpodobnost růstu…",
];

function SpinningMushroom() {
  const bounce = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(tilt, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: -1, duration: 1100, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, tilt]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] });

  return (
    <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
      <MorelLogo height={110} />
    </Animated.View>
  );
}

export function LoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 1400);
    return () => clearInterval(id);
  }, [fade]);

  return (
    <View style={styles.screen}>
      <SpinningMushroom />
      <Text style={styles.brand}>Rostou?</Text>
      <Animated.Text style={[styles.step, { opacity: fade }]}>{STEPS[stepIndex]}</Animated.Text>
      <LoadingProgress />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" },
  brand: { ...type.headingLg, color: palette.ink, marginTop: space.base },
  step: { ...type.bodySmall, color: palette.inkFaint, marginTop: space.sm },
});
