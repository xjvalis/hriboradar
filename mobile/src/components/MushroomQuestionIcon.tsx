import { View } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { palette } from "../theme";

// lucide-react-native has no mushroom glyph, and the app's real mushroom
// artwork (MorelLogo) is a detailed line drawing that doesn't read at icon
// size - this is a small hand-drawn cap+stem silhouette instead, with a
// question-mark badge for "log what you found" (used on the "Moje" screen's
// per-location observation button).
export function MushroomQuestionIcon({ size = 17, color = palette.secondary }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3.5 11C3.5 6.86 7.31 3.5 12 3.5s8.5 3.36 8.5 7.5H3.5z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M9 11v6a3 3 0 0 0 6 0v-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
      <View
        style={{
          position: "absolute",
          right: -3,
          bottom: -3,
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
          <Path
            d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.35-1 .9-1 1.7"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Line x1={12} y1={17} x2={12} y2={17} stroke={color} strokeWidth={2.6} strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}
