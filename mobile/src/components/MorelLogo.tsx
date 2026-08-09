import { Image } from "react-native";

// The app's actual logo artwork (user-supplied line-art of two morels),
// background chroma-keyed to transparent and cropped to content - see
// mobile/assets/logo.webp for the original. A traced/hand-coded SVG
// version was tried first and didn't read as mushrooms at a glance; using
// the real artwork directly removes that risk entirely.
const SOURCE = require("../../assets/logo-mark.png");
const ASPECT = 200 / 360; // source pixel dimensions, width/height

export function MorelLogo({ height }: { height: number }) {
  return (
    <Image
      source={SOURCE}
      style={{ width: height * ASPECT, height }}
      resizeMode="contain"
    />
  );
}
