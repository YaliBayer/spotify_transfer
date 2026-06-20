import { Track } from "../types";

/**
 * Reads a YouTube or YouTube Music playlist via the official Data API v3.
 * Requires a YOUTUBE_API_KEY env var (free tier from Google Cloud Console).
 * Video titles are split heuristically into artist/title since YouTube
 * doesn't expose structured metadata the way Spotify does.
 */
export async function parseYouTubePlaylist(url: string): Promise<{ name: string; tracks: Track[] }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YouTube playlist support requires a YOUTUBE_API_KEY environment variable. Add one or use the manual paste option."
    );
  }

  const playlistId = extractPlaylistId(url);
  if (!playlistId) throw new Error("Could not find a playlist ID in that YouTube URL.");

  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
  );
  if (!metaRes.ok) throw new Error("Failed to read that YouTube playlist. Check the URL and API key.");
  const meta = await metaRes.json();
  const name = meta.items?.[0]?.snippet?.title || "Imported playlist";

  const tracks: Track[] = [];
  let pageToken = "";
  do {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&pageToken=${pageToken}&key=${apiKey}`
    );
    if (!res.ok) throw new Error("Failed to read playlist items from YouTube.");
    const data = await res.json();
    for (const item of data.items || []) {
      const title = item.snippet?.title;
      const channel = item.snippet?.videoOwnerChannelTitle as string | undefined;
      if (!title || title === "Deleted video" || title === "Private video") continue;
      const { artist, track } = splitTitle(title, channel);
      tracks.push({ title: track, artist });
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return { name, tracks };
}

function extractPlaylistId(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get("list");
  } catch {
    return null;
  }
}

function splitTitle(title: string, channel?: string): { artist: string; track: string } {
  const separators = [" - ", " – ", " — ", " | "];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const [first, ...rest] = title.split(sep);
      return { artist: first.trim(), track: rest.join(sep).trim() };
    }
  }
  // Fall back to the channel name as the artist (common for YouTube Music uploads).
  return { artist: (channel || "").replace(/ - Topic$/i, "").trim(), track: title.trim() };
}
