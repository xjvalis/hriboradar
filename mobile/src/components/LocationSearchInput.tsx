import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, radius, space, type } from "../theme";
import { searchLocations, type GeocodeResult } from "../api";

// Self-contained: owns its own query text and debounced results, and hands
// back just the picked result. Built to be dropped into any screen that
// needs "type a place name, pick a suggestion" - Settings today, the
// (currently disabled) "add a saved place" flow on Moje once that ships.
export function LocationSearchInput({ onSelect }: { onSelect: (result: GeocodeResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchLocations(query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Hledat místo (např. Smržovka)"
        placeholderTextColor={palette.inkFaint}
      />
      {loading && query.trim().length >= 3 && <Text style={styles.hint}>Hledám…</Text>}
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((r, i) => (
            <Pressable
              // Nominatim occasionally returns two distinct results (e.g. a
              // village and its own administrative boundary) at the exact
              // same coordinate - lat/lon alone isn't a reliable unique key.
              key={`${i}:${r.lat},${r.lon}`}
              style={[styles.result, i > 0 && styles.resultBorder]}
              onPress={() => {
                onSelect(r);
                setQuery("");
                setResults([]);
              }}
            >
              <Text style={styles.resultLabel}>{r.label}</Text>
              {r.sublabel ? <Text style={styles.resultSublabel}>{r.sublabel}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    // Explicit height (not just vertical padding) so this lines up exactly
    // with MojeScreen's "Najít na mapě" button sitting right below it -
    // see that component's manualToggle comment.
    height: 46,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: palette.ink,
  },
  hint: { ...type.caption, color: palette.inkFaint, marginTop: space.xs, marginLeft: 2 },
  results: {
    marginTop: space.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  result: { paddingHorizontal: space.md, paddingVertical: space.sm },
  resultBorder: { borderTopWidth: 1, borderTopColor: palette.line },
  resultLabel: { ...type.body, color: palette.ink },
  resultSublabel: { ...type.caption, color: palette.inkFaint, marginTop: 1 },
});
