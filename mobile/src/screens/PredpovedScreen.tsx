import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import { palette, radius, scoreColor, scoreFlavor, scoreLabel, space, type } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { useLocation } from "../LocationContext";
import { useSavedLocations } from "../SavedLocationsContext";
import { computeDailyOverall, findNextOpportunity, weekdayLabel, dayMonthLabel } from "../forecastMath";
import { PageHeader } from "../components/PageHeader";
import { PaperBackground } from "../components/PaperBackground";
import { Chip } from "../components/Chip";
import { Card } from "../components/Card";
import { WeatherSummary } from "../components/WeatherSummary";
import { MushroomCard } from "../components/MushroomCard";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { CurrentLocationPill } from "../components/CurrentLocationPill";
import { useSubscription } from "../SubscriptionContext";
import { usePaywall } from "../PaywallContext";

export default function PredpovedScreen() {
  const { location } = useLocation();
  const { locations: saved } = useSavedLocations();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { openPaywall } = usePaywall();

  // Excludes a saved place that's also the current location (e.g. after
  // tapping it on Moje to "set as current") - without this it appeared
  // twice, once as "Aktuální" and again under its own name, with the same
  // coordinates backing both chips and colliding as React keys below.
  const trackedLocations = useMemo(
    () => [
      location,
      ...saved.filter((s) => Math.abs(s.lat - location.lat) >= 0.001 || Math.abs(s.lon - location.lon) >= 0.001),
    ],
    [location, saved]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const active = trackedLocations[activeIndex] ?? location;

  const [detail, setDetail] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    getForecast(active.lat, active.lon)
      .then((d) => {
        setDetail(d);
        setSelectedDate(null); // reset to "let the data decide" for the new location
      })
      .catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.lat, active.lon]);

  const daily = useMemo(() => (detail ? computeDailyOverall(detail) : []), [detail]);
  const opportunity = useMemo(
    () => (detail ? findNextOpportunity(daily, detail.today) : null),
    [daily, detail]
  );

  // Free tier only ever shows today's detail, even as the default pick -
  // the upcoming-opportunity headline below still teases "za 3 dny by
  // mohly růst houby" (that's the whole point, it's what makes paying for
  // the full week worth it), it just doesn't silently jump the detail
  // view to a day a free user can't actually open.
  const shownDate =
    selectedDate ??
    (isPremium && opportunity?.type === "upcoming" ? opportunity.date : detail?.today) ??
    null;
  const shownDay = daily.find((d) => d.date === shownDate);
  const shownWeather = detail?.weather.find((w) => w.date === shownDate);
  const shownSpecies = detail
    ? [...detail.species]
        .map((sp) => ({ sp, day: sp.days.find((d) => d.date === shownDate) }))
        .filter((x): x is { sp: (typeof detail.species)[number]; day: NonNullable<typeof x.day> } => !!x.day)
        .sort((a, b) => b.day.probability_pct - a.day.probability_pct)
        .slice(0, 8)
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <PaperBackground style={styles.content}>
      <PageHeader
        eyebrow="7 dní dopředu"
        title="Předpověď"
        subtitle="Kdy a kde by mohly houby začít růst."
        right={<CurrentLocationPill />}
      />

      {trackedLocations.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.locationRow}
          contentContainerStyle={{ gap: space.sm }}
        >
          {trackedLocations.map((loc, i) => (
            <Chip
              key={`${loc.lat},${loc.lon}`}
              label={i === 0 ? `Aktuální · ${loc.label}` : loc.label}
              active={i === activeIndex}
              onPress={() => setActiveIndex(i)}
            />
          ))}
        </ScrollView>
      )}

      {error && (
        <Text style={styles.error}>
          Nepodařilo se načíst předpověď: {error}
        </Text>
      )}

      {!detail && !error && (
        <View style={[styles.padded, { marginTop: space.base, gap: space.sm }]}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      )}

      {detail && opportunity && (
        <Card style={styles.headline}>
          {opportunity.type === "now" ? (
            <>
              <Text style={styles.headlineEyebrow}>Teď</Text>
              <Text style={styles.headlineTitle}>{scoreFlavor(opportunity.value)}</Text>
            </>
          ) : opportunity.type === "upcoming" ? (
            <>
              <Text style={styles.headlineEyebrow}>
                Za {opportunity.daysAhead} {opportunity.daysAhead === 1 ? "den" : opportunity.daysAhead < 5 ? "dny" : "dní"}
              </Text>
              <Text style={styles.headlineTitle}>
                V okolí {active.label} by mohly začít růst houby
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.headlineEyebrow}>V příštích 7 dnech</Text>
              <Text style={styles.headlineTitle}>Nečeká se výrazné zlepšení podmínek</Text>
            </>
          )}
        </Card>
      )}

      {daily.length > 0 && detail && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayRow}
          contentContainerStyle={{ gap: space.sm }}
        >
          {daily.map((d) => {
            const isSelected = d.date === shownDate;
            const color = scoreColor(d.overall);
            // Today is always free; the rest of the week is the Plus
            // feature - still shown (with a real score, not blurred out)
            // so it's obvious there's something worth unlocking, just
            // locked behind the paywall instead of the usual day-select.
            // subscriptionLoading guard: see SubscriptionContext.tsx -
            // without it, a real Plus subscriber sees the whole week
            // lock icons for as long as RevenueCat's fetch is in flight.
            const locked = !subscriptionLoading && !isPremium && d.date !== detail.today;
            return (
              <Pressable
                key={d.date}
                onPress={() =>
                  locked ? openPaywall("Chcete vidět předpověď na celý týden dopředu?") : setSelectedDate(d.date)
                }
                style={[styles.dayCard, isSelected && styles.dayCardActive]}
              >
                <Text style={styles.dayWeekday}>{weekdayLabel(d.date, detail.today)}</Text>
                <View style={[styles.dayScoreDot, { borderColor: color }]}>
                  {locked ? (
                    <Lock size={13} strokeWidth={2} color={palette.inkFaint} />
                  ) : (
                    <Text style={[styles.dayScoreText, { color }]}>{d.overall}</Text>
                  )}
                </View>
                <Text style={styles.dayDate}>{dayMonthLabel(d.date)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {shownDay && shownWeather && (
        <>
          <Text style={styles.sectionTitle}>
            {weekdayLabel(shownDay.date, detail!.today)} {dayMonthLabel(shownDay.date)} ·{" "}
            <Text style={{ color: scoreColor(shownDay.overall) }}>{scoreLabel(shownDay.overall)}</Text>
          </Text>
          <View style={styles.padded}>
            <WeatherSummary
              tempC={
                shownDay.date === detail!.today && detail!.current
                  ? detail!.current.tempC
                  : shownWeather.tempC
              }
              tempLabel={
                shownDay.date === detail!.today && detail!.current ? "Teplota" : "Průměrná denní teplota"
              }
              soilMoisturePct={shownWeather.soilMoisturePct}
              daysSinceRain={shownSpecies[0]?.day.factors.days_since_rain ?? null}
            />
          </View>

          <Text style={styles.sectionTitle}>Co by mohlo růst</Text>
          <View style={[styles.padded, { gap: space.sm }]}>
            {shownSpecies.map(({ sp, day }) => (
              <MushroomCard
                key={sp.id}
                id={sp.id}
                nameCz={sp.name_cz}
                nameLatin={sp.name_latin}
                probabilityPct={day.probability_pct}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.disclaimer}>
        Předpověď na 7 dní dopředu je odhad podle vývoje počasí - čím dál v budoucnu, tím méně jistý.
      </Text>
      </PaperBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space.xxl },
  padded: { paddingHorizontal: space.lg },
  locationRow: { flexGrow: 0, paddingHorizontal: space.lg, marginBottom: space.sm },
  error: { ...type.bodySmall, color: palette.danger, paddingHorizontal: space.lg, marginTop: space.sm },
  headline: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  headlineEyebrow: { ...type.label, color: palette.springGreen },
  headlineTitle: { ...type.headingMd, color: palette.white, marginTop: 4 },
  dayRow: { flexGrow: 0, paddingHorizontal: space.lg, marginTop: space.lg },
  dayCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayCardActive: { borderColor: palette.line, backgroundColor: palette.surface },
  dayWeekday: { ...type.caption, color: palette.inkSoft },
  dayScoreDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dayScoreText: { ...type.headingSm, fontSize: 12.5 },
  dayDate: { ...type.caption, color: palette.inkFaint },
  sectionTitle: {
    ...type.label,
    color: palette.inkSoft,
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  disclaimer: {
    ...type.caption,
    color: palette.inkFaint,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    lineHeight: 16,
  },
});
