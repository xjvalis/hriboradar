import { Image } from "react-native";

// The app's logo mark - a mushroom cap around a map pin (2026-09-01
// redesign; the original two-morels line art is kept at
// assets/backup-old-logo/ in case this ever needs reverting). Two source
// images, not one scaled: the detailed version's thin topographic contour
// lines blur into a gray smudge at top-bar size (found the same day this
// shipped) - below SIMPLE_THRESHOLD this swaps to a solid-fill silhouette
// of the identical shape instead of just rendering the same art smaller.
const SOURCE_DETAILED = require("../../assets/logo-mark.png");
const ASPECT_DETAILED = 561 / 517;
const SOURCE_SIMPLE = require("../../assets/logo-mark-simple.png");
const ASPECT_SIMPLE = 569 / 523;
const SIMPLE_THRESHOLD = 40; // px - below this the contour lines stop reading clearly

export function MorelLogo({ height }: { height: number }) {
  const useSimple = height < SIMPLE_THRESHOLD;
  const source = useSimple ? SOURCE_SIMPLE : SOURCE_DETAILED;
  const aspect = useSimple ? ASPECT_SIMPLE : ASPECT_DETAILED;
  return (
    <Image
      source={source}
      style={{ width: height * aspect, height }}
      resizeMode="contain"
    />
  );
}
