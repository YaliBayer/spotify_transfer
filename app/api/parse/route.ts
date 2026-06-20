import { NextRequest, NextResponse } from "next/server";
import { detectPlatform } from "@/lib/parsers/detect";
import { fetchPublicSpotifyPlaylist } from "@/lib/spotify";
import { parseAppleMusicPlaylist } from "@/lib/parsers/appleMusic";
import { parseYouTubePlaylist } from "@/lib/parsers/youtube";
import { parseManualText } from "@/lib/parsers/manual";
import { ParseResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url, manualText } = body as { url?: string; manualText?: string };

  try {
    if (manualText && manualText.trim()) {
      const tracks = parseManualText(manualText);
      const result: ParseResult = { platform: "manual", sourceName: "Pasted track list", tracks };
      return NextResponse.json(result);
    }

    if (!url || !url.trim()) {
      return NextResponse.json({ error: "Paste a playlist link or a track list first." }, { status: 400 });
    }

    const platform = detectPlatform(url.trim());

    if (platform === "spotify") {
      const { name, tracks } = await fetchPublicSpotifyPlaylist(url.trim());
      const result: ParseResult = { platform: "spotify", sourceName: name, tracks };
      return NextResponse.json(result);
    }

    if (platform === "apple-music") {
      const { name, tracks } = await parseAppleMusicPlaylist(url.trim());
      if (tracks.length === 0) {
        return NextResponse.json(
          {
            error:
              "Couldn't read any tracks from that Apple Music page. Apple's page format changes often — use 'Paste a track list' below instead.",
          },
          { status: 422 }
        );
      }
      const result: ParseResult = { platform: "apple-music", sourceName: name, tracks };
      return NextResponse.json(result);
    }

    if (platform === "youtube") {
      const { name, tracks } = await parseYouTubePlaylist(url.trim());
      const result: ParseResult = { platform: "youtube", sourceName: name, tracks };
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "That link isn't from a supported source yet. Use 'Paste a track list' below instead." },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong reading that playlist.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
