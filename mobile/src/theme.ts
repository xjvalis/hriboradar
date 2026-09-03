// ============================================================================
// DESIGN SYSTEM - "Hřiboradar"
// Modern Czech mycology: botanical field guide translated into a 2026
// consumer mobile app. Forest + paper + restraint, not SaaS-dashboard.
// Every screen must consume these tokens - no ad-hoc hex values or
// one-off spacing in screen code.
// ============================================================================

import { Dimensions, Platform } from "react-native";

export const palette = {
  bg: "#EDE6D6",
  surface: "#F7F2E7",
  surfaceSunken: "#E4DCC6",
  ink: "#24261D",
  inkSoft: "#54563E",
  inkFaint: "#8C8A6E",
  line: "#DBCFA9",

  primary: "#33482C", // deep forest green - primary actions, active states
  primaryDeep: "#243420",
  secondary: "#7C8552", // moss / muted olive - tags, secondary emphasis
  accent: "#B5652E", // restrained earthy accent (terracotta) - used sparingly
  danger: "#A23B2E", // muted red - poisonous warnings, errors
  success: "#4F7A3D", // natural green - good conditions, confirmations

  wood: "#6B4A2E", // brown wood - top-bar icon color
  springGreen: "#6FA23A", // fresh conifer-needle green - active nav icon ring

  white: "#FFFFFF",
} as const;

export function scoreTier(pct: number): "good" | "medium" | "poor" {
  if (pct >= 55) return "good";
  if (pct >= 28) return "medium";
  return "poor";
}

export function scoreColor(pct: number): string {
  const tier = scoreTier(pct);
  return tier === "good" ? palette.success : tier === "medium" ? palette.accent : palette.danger;
}

export function scoreLabel(pct: number): string {
  // A real, hard zero (not just "poor") only happens when the terrain grid
  // found no forest within ~750m at all (see terrainMatchFactor in
  // lib/terrain.ts) - a city block or open field, not just bad weather.
  // Worth its own copy rather than folding into "Nepravděpodobné", which
  // reads like "technically possible, just unlikely."
  if (pct === 0) return "Tady žádný les není";
  const tier = scoreTier(pct);
  return tier === "good" ? "Dobré podmínky" : tier === "medium" ? "Slabší šance" : "Nepravděpodobné";
}

// A one-line editorial opener, distinct from scoreLabel (a status word) -
// this is the "field guide voice" line that precedes the factual weather
// explanation, e.g. "Houbám dnes chybí vlhkost a čas. 4. den po dešti..."
export function scoreFlavor(pct: number): string {
  if (pct === 0) return "Nejspíš byste tu houbu hledali marně";
  const tier = scoreTier(pct);
  if (tier === "good") return "Dnes to v lese žije";
  if (tier === "medium") return "Les se pomalu probouzí";
  return "Houbám dnes chybí vlhkost a čas";
}

// ---------------------------------------------------------------------------
// Typography - one editorial display serif (Fraunces), one UI sans (Manrope).
// ---------------------------------------------------------------------------
export const fontFamily = {
  displayBold: "Fraunces-Bold",
  displaySemiBold: "Fraunces-SemiBold",
  uiRegular: "Manrope-Regular",
  uiMedium: "Manrope-Medium",
  uiSemiBold: "Manrope-SemiBold",
  uiBold: "Manrope-Bold",
  uiExtraBold: "Manrope-ExtraBold",
};

// Every fontSize/lineHeight below was tuned for a phone held ~30cm from the
// face. An iPad (or any tablet) is physically much bigger but RN points
// don't scale with screen size on their own, so the exact same numbers
// read as noticeably small text on a big screen - found 2026-09-02
// (screenshot from a real iPad showed this). Platform.isPad is a stable,
// one-time device check (not viewport width, which changes on rotation but
// tablet-ness itself never does) - Android's rough tablet check falls back
// to physical screen size since Platform has no isPad equivalent there.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// Platform.isPad only exists on the iOS-specific Platform type - this file
// isn't a .ios.ts split, so TS resolves the generic/Android type here,
// which doesn't declare it even though the property is genuinely present
// at runtime on iOS.
const isPad = (Platform as unknown as { isPad?: boolean }).isPad === true;
// Exported - PaperBackground.tsx uses the same check to cap/center content
// width on tablet (a phone-width column of text stretched edge-to-edge
// across an iPad is the other half of "this doesn't feel designed for
// tablet", not just small font).
// Web is excluded from the physical-size fallback: a browser window's
// width/height says nothing about the device it's running on (an ordinary
// desktop window is routinely >700px on both axes), so on web this would
// otherwise evaluate true almost universally instead of only on real
// tablets - found 2026-09-02 testing localhost in a normal-sized window.
// EXPO_PUBLIC_FORCE_TABLET is the deliberate escape hatch for previewing
// the tablet layout on web anyway (no iPad/Simulator on hand) - dev-only,
// same guard pattern as EXPO_PUBLIC_FORCE_PREMIUM in SubscriptionContext.
const FORCE_TABLET_DEV = __DEV__ && process.env.EXPO_PUBLIC_FORCE_TABLET === "true";
export const IS_TABLET =
  isPad || FORCE_TABLET_DEV || (Platform.OS !== "web" && Math.min(SCREEN_W, SCREEN_H) >= 700);
const FONT_SCALE = IS_TABLET ? 1.2 : 1;

// Same scale, for raw numbers that aren't full `type.*` style objects -
// icon `size` props (lucide-react-native takes a plain number, not a
// style), icon-button hit-target width/height, and the handful of chrome
// styles (tab-bar labels, TopBar's notification badge) that spread
// `...type.caption` and then immediately override fontSize with a literal
// number, which bypasses scaled() entirely. Phone: returns n unchanged.
export function ts(n: number): number {
  return IS_TABLET ? Math.round(n * FONT_SCALE) : n;
}

function scaled<T extends { fontSize: number; lineHeight?: number; letterSpacing?: number }>(style: T): T {
  if (FONT_SCALE === 1) return style;
  return {
    ...style,
    fontSize: Math.round(style.fontSize * FONT_SCALE * 10) / 10,
    ...(style.lineHeight != null ? { lineHeight: Math.round(style.lineHeight * FONT_SCALE * 10) / 10 } : {}),
    ...(style.letterSpacing != null ? { letterSpacing: Math.round(style.letterSpacing * FONT_SCALE * 100) / 100 } : {}),
  };
}

export const type = {
  displayXl: scaled({ fontFamily: fontFamily.displayBold, fontSize: 34, lineHeight: 38 }),
  displayLg: scaled({ fontFamily: fontFamily.displayBold, fontSize: 26, lineHeight: 30 }),
  headingLg: scaled({ fontFamily: fontFamily.displaySemiBold, fontSize: 20, lineHeight: 25 }),
  headingMd: scaled({ fontFamily: fontFamily.displaySemiBold, fontSize: 17, lineHeight: 22 }),
  headingSm: scaled({ fontFamily: fontFamily.uiBold, fontSize: 14.5, lineHeight: 19 }),
  eyebrow: scaled({ fontFamily: fontFamily.displaySemiBold, fontStyle: "italic" as const, fontSize: 13, lineHeight: 17 }),
  body: scaled({ fontFamily: fontFamily.uiRegular, fontSize: 14.5, lineHeight: 21 }),
  bodySmall: scaled({ fontFamily: fontFamily.uiRegular, fontSize: 12.5, lineHeight: 18 }),
  caption: scaled({ fontFamily: fontFamily.uiMedium, fontSize: 11, lineHeight: 15 }),
  label: scaled({
    fontFamily: fontFamily.uiExtraBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  }),
};

// ---------------------------------------------------------------------------
// Spacing - one scale, used everywhere. No invented one-off margins.
// ---------------------------------------------------------------------------
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
};

// ---------------------------------------------------------------------------
// Radius - restrained. Cards are structured, not pills.
// ---------------------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 22,
  pill: 999,
};

// ---------------------------------------------------------------------------
// Shadow - used sparingly (sheets/modals only). Cards prefer borders.
// ---------------------------------------------------------------------------
export const shadow = {
  sheet: {
    shadowColor: "#1A1710",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  card: {
    shadowColor: "#1A1710",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
};
