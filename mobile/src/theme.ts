// Design tokens, ported from the Claude Artifact mockup (kderostouhouby.cz-
// inspired palette: ivory background, Fraunces/Nunito, green as the one
// action color, green/amber/terracotta score-tier pills).

export const colors = {
  bg: "#F1ECDC",
  surface: "#FFFFFF",
  ink: "#2A2418",
  inkSoft: "#5A4A30",
  inkFaint: "#8A7858",
  green: "#3F5E2C",
  greenDeep: "#2B3A24",
  line: "#E4D9BC",
  scoreGood: "#8FAB4E",
  scoreMedium: "#C68A1F",
  scorePoor: "#B86E3C",
};

export function scoreTier(pct: number): "good" | "medium" | "poor" {
  if (pct >= 50) return "good";
  if (pct >= 25) return "medium";
  return "poor";
}

export function scoreColor(pct: number): string {
  const tier = scoreTier(pct);
  return tier === "good" ? colors.scoreGood : tier === "medium" ? colors.scoreMedium : colors.scorePoor;
}

export const fonts = {
  serif: "Fraunces-SemiBold",
  serifBold: "Fraunces-Bold",
  sans: "Nunito-Regular",
  sansBold: "Nunito-Bold",
  sansExtraBold: "Nunito-ExtraBold",
};
