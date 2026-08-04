import Svg, { Path, Circle } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

export function MapIcon({ size = 15, color = "#5A4A30" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <Path d="M9 4v14M15 6v14" />
    </Svg>
  );
}

export function HomeIcon({ size = 15, color = "#5A4A30" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M4 11.5 12 4l8 7.5" />
      <Path d="M6 10v10h12V10" />
    </Svg>
  );
}

export function BookIcon({ size = 15, color = "#5A4A30" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M4 5c3-1.5 6-1.5 8 0 2-1.5 5-1.5 8 0v14c-3-1.5-6-1.5-8 0-2-1.5-5-1.5-8 0Z" />
      <Path d="M12 5v14" />
    </Svg>
  );
}

export function PinIcon({ size = 15, color = "#5A4A30" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
      <Circle cx={12} cy={9.5} r={2.4} />
    </Svg>
  );
}
