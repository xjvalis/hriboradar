// fetch() doesn't expose download progress in React Native the way it does
// on web (no reliable streaming response body across platforms) - XHR's
// onprogress does, on both, so this is the one real signal available for
// "how much of this response has actually arrived."
//
// Vercel serves /api/grid without a Content-Length header (brotli-encoded,
// chunked transfer), so `lengthComputable` is false and `event.total` is
// unusable - the percentage below is real bytes received divided by an
// *estimated* total (measured against the real production response,
// checked 2026-08-26: ~4-5KB compressed), not a server-declared one. Still
// genuinely moving in response to the network, unlike a timer.
const ESTIMATED_GRID_BYTES = 6000;

export function fetchJsonWithProgress<T>(url: string, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onprogress = (e) => {
      const total = e.lengthComputable && e.total > 0 ? e.total : ESTIMATED_GRID_BYTES;
      onProgress(Math.min(99, Math.round((e.loaded / total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Server vrátil chybu ${xhr.status}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Síťová chyba"));
    xhr.send();
  });
}
