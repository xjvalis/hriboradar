// ============================================================================
// DESIGN SYSTEM — "Rostou?"
// Modern Czech mycology: botanical field guide translated into a 2026
// consumer mobile app. Forest + paper + restraint, not SaaS-dashboard.
// Every screen must consume these tokens — no ad-hoc hex values or
// one-off spacing in screen code.
// ============================================================================

export const palette = {
  bg: "#EDE6D6",
  surface: "#F7F2E7",
  surfaceSunken: "#E4DCC6",
  ink: "#24261D",
  inkSoft: "#54563E",
  inkFaint: "#8C8A6E",
  line: "#DBCFA9",

  primary: "#33482C", // deep forest green — primary actions, active states
  primaryDeep: "#243420",
  secondary: "#7C8552", // moss / muted olive — tags, secondary emphasis
  accent: "#B5652E", // restrained earthy accent (terracotta) — used sparingly
  danger: "#A23B2E", // muted red — poisonous warnings, errors
  success: "#4F7A3D", // natural green — good conditions, confirmations

  wood: "#6B4A2E", // brown wood — top-bar icon color
  springGreen: "#6FA23A", // fresh conifer-needle green — active nav icon ring

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
  const tier = scoreTier(pct);
  return tier === "good" ? "Dobré podmínky" : tier === "medium" ? "Slabší šance" : "Nepravděpodobné";
}

// A one-line editorial opener, distinct from scoreLabel (a status word) —
// this is the "field guide voice" line that precedes the factual weather
// explanation, e.g. "Houbám dnes chybí vlhkost a čas. 4. den po dešti..."
export function scoreFlavor(pct: number): string {
  const tier = scoreTier(pct);
  if (tier === "good") return "Dnes to v lese žije";
  if (tier === "medium") return "Les se pomalu probouzí";
  return "Houbám dnes chybí vlhkost a čas";
}

// ---------------------------------------------------------------------------
// Typography — one editorial display serif (Fraunces), one UI sans (Manrope).
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

export const type = {
  displayXl: { fontFamily: fontFamily.displayBold, fontSize: 34, lineHeight: 38 },
  displayLg: { fontFamily: fontFamily.displayBold, fontSize: 26, lineHeight: 30 },
  headingLg: { fontFamily: fontFamily.displaySemiBold, fontSize: 20, lineHeight: 25 },
  headingMd: { fontFamily: fontFamily.displaySemiBold, fontSize: 17, lineHeight: 22 },
  headingSm: { fontFamily: fontFamily.uiBold, fontSize: 14.5, lineHeight: 19 },
  eyebrow: { fontFamily: fontFamily.displaySemiBold, fontStyle: "italic" as const, fontSize: 13, lineHeight: 17 },
  body: { fontFamily: fontFamily.uiRegular, fontSize: 14.5, lineHeight: 21 },
  bodySmall: { fontFamily: fontFamily.uiRegular, fontSize: 12.5, lineHeight: 18 },
  caption: { fontFamily: fontFamily.uiMedium, fontSize: 11, lineHeight: 15 },
  label: {
    fontFamily: fontFamily.uiExtraBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
};

// ---------------------------------------------------------------------------
// Spacing — one scale, used everywhere. No invented one-off margins.
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
// Radius — restrained. Cards are structured, not pills.
// ---------------------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  sheet: 22,
  pill: 999,
};

// ---------------------------------------------------------------------------
// Shadow — used sparingly (sheets/modals only). Cards prefer borders.
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
