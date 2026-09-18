import { useEffect, useRef, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { palette, radius, shadow, space, IS_TABLET } from "../theme";

// Every bottom sheet in the app (location/species detail, observation,
// paywall, ...) goes through this one component, so capping it here is
// what actually stops a full-edge-to-edge sheet from reading as an
// unreasonably long line length on a 13" iPad - same TABLET_MAX_WIDTH/
// centering idea as PaperBackground.tsx, just anchored to the bottom
// instead of scrolling content.
const TABLET_MAX_WIDTH = 640;

// Backdrop tap and swipe-down-to-dismiss, shared by every bottom sheet in
// the app (location detail, species detail, ...) - previously only the
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
    // A plain absolutely-positioned View here (no RN Modal) used to sit in
    // the same native view/window as whatever screen opened it - visually
    // on top, but not a separate native layer, so a screen with its own
    // pull-to-refresh (e.g. Předpověď) could still have its ScrollView's
    // native RefreshControl gesture recognizer compete for a downward drag
    // that started over the sheet, occasionally winning it instead of this
    // component's own PanResponder (found 2026-09-18: dragging down on the
    // handle sometimes refreshed the screen behind instead of dismissing
    // the sheet). Modal renders into a genuinely separate native
    // window/layer, so touches inside it can never reach a scroll view
    // behind it at all - the standard fix for this class of gesture
    // conflict, not just a bigger hit area or a capture-phase tweak.
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      {/* iOS doesn't resize/reposition anything on its own when the keyboard
          opens - without this, a text input near the bottom of a sheet (e.g.
          LocationSearchInput in LocationPickerSheet) just sits underneath the
          keyboard, invisible while typing. "padding" pushes the whole sheet up
          by the keyboard's height instead. Android already resizes the window
          itself (windowSoftInputMode, the RN default), so adding this there
          too would double-shift the sheet - undefined behavior is a no-op. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            shadow.sheet,
            IS_TABLET && styles.sheetTablet,
            maxHeight != null && { maxHeight },
            { transform: [{ translateY: Animated.add(translateY, panY) }] },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
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
  sheetTablet: {
    width: "100%",
    maxWidth: TABLET_MAX_WIDTH,
    alignSelf: "center",
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
