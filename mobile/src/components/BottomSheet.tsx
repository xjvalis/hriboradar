import { useEffect, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { palette, radius, shadow, space } from "../theme";

// Backdrop tap and swipe-down-to-dismiss, shared by every bottom sheet in
// the app (location detail, species detail, ...) — previously only the
// explicit "Zavřít" text closed these, which is a dead end for anyone used
// to how every other sheet/modal on their phone behaves.
export function BottomSheet({
  onClose,
  maxHeight,
  children,
}: {
  onClose: () => void;
  maxHeight?: number | `${number}%`;
  children: ReactNode;
}) {
  const translateY = useRef(new Animated.Value(400)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16 }).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) panY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 1.1) {
          onClose();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, damping: 16 }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          shadow.sheet,
          maxHeight != null && { maxHeight },
          { transform: [{ translateY: Animated.add(translateY, panY) }] },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#00000033",
    justifyContent: "flex-end",
    zIndex: 90,
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handleArea: { paddingTop: space.sm, paddingBottom: space.xs },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    alignSelf: "center",
  },
});
