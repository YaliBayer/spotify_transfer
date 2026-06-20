export type Platform = "spotify" | "apple-music" | "youtube" | "unknown";

export function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes("open.spotify.com")) return "spotify";
  if (lower.includes("music.apple.com")) return "apple-music";
  if (lower.includes("youtube.com") || lower.includes("music.youtube.com")) return "youtube";
  return "unknown";
}
