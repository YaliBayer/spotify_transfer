import { NextRequest, NextResponse } from "next/server";
import { decryptSession, encryptSession, SESSION_COOKIE } from "@/lib/session";
import {
  ensureFreshSession,
  getCurrentUser,
  searchTrack,
  createPlaylist,
  addTracksToPlaylist,
} from "@/lib/spotify";
import { Track, TransferResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = decryptSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Connect your Spotify account first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { tracks, playlistName, isPublic } = body as {
    tracks?: Track[];
    playlistName?: string;
    isPublic?: boolean;
  };

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "No tracks to transfer." }, { status: 400 });
  }
  if (!playlistName || !playlistName.trim()) {
    return NextResponse.json({ error: "Give the new playlist a name." }, { status: 400 });
  }

  try {
    const fresh = await ensureFreshSession(session);
    const user = await getCurrentUser(fresh.access_token);

    const matched: Track[] = [];
    const unmatched: Track[] = [];
    const uris: string[] = [];

    for (const track of tracks) {
      if (!track.title) {
        unmatched.push(track);
        continue;
      }
      const uri = await searchTrack(fresh.access_token, track);
      if (uri) {
        matched.push(track);
        uris.push(uri);
      } else {
        unmatched.push(track);
      }
    }

    const playlist = await createPlaylist(fresh.access_token, playlistName.trim(), Boolean(isPublic));
    if (uris.length > 0) {
      await addTracksToPlaylist(fresh.access_token, playlist.id, uris);
    }

    const result: TransferResult = {
      playlistUrl: playlist.url,
      playlistName: playlistName.trim(),
      total: tracks.length,
      matched,
      unmatched,
    };

    const res = NextResponse.json(result);
    if (fresh.access_token !== session.access_token) {
      res.cookies.set(SESSION_COOKIE, encryptSession(fresh), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transfer failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
