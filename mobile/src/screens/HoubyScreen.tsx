import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { palette, space, type } from "../theme";
import { getForecast, type ForecastResponse } from "../api";
import { PageHeader } from "../components/PageHeader";
import { MushroomCard } from "../components/MushroomCard";
import { CardSkeleton } from "../components/LoadingSkeleton";

const DEFAULT_LOCATION = { lat: 50.075, lon: 14.44 };

export default function HoubyScreen() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getForecast(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const sorted = [...(data?.species ?? [])].sort((a, b) =>
    a.name_cz.localeCompare(b.name_cz, "cs")
  );

  return (
    <View style={styles.screen}>
      <PageHeader eyebrow={`všech ${data?.species.length ?? 15} druhů`} title="Houby" />
      {error && <Text style={styles.error}>Nepodařilo se načíst atlas: {error}</Text>}
      <FlatList
        data={sorted.length ? sorted : Array.from({ length: 6 })}
        keyExtractor={(item, i) => (item as any)?.id ?? String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          sorted.length ? (
            <MushroomCard
              id={(item as any).id}
              nameCz={(item as any).name_cz}
              nameLatin={(item as any).name_latin}
              edibility={(item as any).edibility}
            />
          ) : (
            <CardSkeleton />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  error: { ...type.bodySmall, color: palette.danger, paddingHorizontal: space.lg, marginBottom: space.sm },
});
