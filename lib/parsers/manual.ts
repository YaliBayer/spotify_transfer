import { Track } from "../types";

/**
 * Lets the user paste a plain-text track list for any source that doesn't
 * have a dedicated parser (Tidal, Deezer, SoundCloud, a hand-typed list...).
 * Accepts one track per line, in "Artist - Title" or "Title - Artist" form,
 * or just a bare title if nothing else is available.
 */
export function parseManualText(text: string): Track[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tracks: Track[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, ""); // strip leading "1. " numbering
    const separators = [" - ", " – ", " — "];
    let matched = false;
    for (const sep of separators) {
      if (cleaned.includes(sep)) {
        const [a, b] = cleaned.split(sep);
        tracks.push({ artist: a.trim(), title: b.trim() });
        matched = true;
        break;
      }
    }
    if (!matched && cleaned) {
      tracks.push({ artist: "", title: cleaned });
    }
  }
  return tracks;
}
