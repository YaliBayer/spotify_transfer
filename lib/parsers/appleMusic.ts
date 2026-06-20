import * as cheerio from "cheerio";
import { Track } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Apple Music has no public API for reading playlists, so this works by
 * fetching the public web player page and walking its embedded JSON for
 * objects that look like tracks. Apple changes this markup periodically,
 * so treat this as best-effort: if it returns zero tracks, use the
 * "paste track list manually" option in the UI instead.
 */
export async function parseAppleMusicPlaylist(url: string): Promise<{ name: string; tracks: Track[] }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error("Could not load that Apple Music page. Make sure the playlist is public.");
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const pageTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    "Imported playlist";

  const candidates: Record<string, unknown>[] = [];

  $('script[type="application/json"]').each((_, el) => {
    const text = $(el).text();
    if (!text) return;
    try {
      const json = JSON.parse(text);
      walk(json, candidates);
    } catch {
      // ignore malformed/unrelated JSON blocks
    }
  });

  const tracks = dedupe(candidates.map(toTrack).filter((t): t is Track => t !== null));

  // Drop an entry that's just the playlist itself if it slipped through.
  const filtered = tracks.filter((t) => t.title && t.title !== pageTitle);

  return { name: pageTitle, tracks: filtered };
}

function walk(node: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 14 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (looksLikeTrack(obj)) out.push(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") walk(value, out, depth + 1);
  }
}

function looksLikeTrack(obj: Record<string, unknown>): boolean {
  const hasTitle = typeof obj.title === "string" && obj.title.length > 0;
  const hasName = typeof obj.name === "string" && obj.name.length > 0;
  const artistField =
    (typeof obj.subtitleLinks === "object" && obj.subtitleLinks) ||
    obj.artistName ||
    obj.subtitle;
  const hasArtist =
    typeof artistField === "string" ||
    (Array.isArray(artistField) && artistField.length > 0);
  const kind = String(obj.kind || obj.type || "").toLowerCase();
  const kindLooksLikeSong = kind.includes("song") || kind.includes("track") || kind === "";
  return (hasTitle || hasName) && hasArtist && kindLooksLikeSong;
}

function toTrack(obj: Record<string, unknown>): Track | null {
  const title = (obj.title as string) || (obj.name as string);
  if (!title) return null;

  let artist = "";
  if (typeof obj.artistName === "string") {
    artist = obj.artistName;
  } else if (typeof obj.subtitle === "string") {
    artist = obj.subtitle;
  } else if (Array.isArray(obj.subtitleLinks)) {
    artist = (obj.subtitleLinks as Array<{ title?: string }>)
      .map((l) => l.title)
      .filter(Boolean)
      .join(", ");
  }
  if (!artist) return null;

  const album = typeof obj.albumName === "string" ? obj.albumName : undefined;

  return { title: title.trim(), artist: artist.trim(), album };
}

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
