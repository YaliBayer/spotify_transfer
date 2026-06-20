import { Track } from "./types";
import { Session } from "./session";

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const SPOTIFY_SCOPES = "playlist-modify-public playlist-modify-private";

export function getAuthorizeUrl(state: string): string {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

function basicAuthHeader(): string {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeCodeForToken(code: string): Promise<Session> {
  const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<Session> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    // Spotify only returns a new refresh_token sometimes; keep the old one otherwise.
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function ensureFreshSession(session: Session): Promise<Session> {
  // Refresh if the token expires in less than 60 seconds.
  if (session.expires_at - Date.now() > 60_000) return session;
  return refreshAccessToken(session.refresh_token);
}

// App-level token (Client Credentials flow) used for read-only public lookups,
// e.g. pulling track listings from a public Spotify playlist without user login.
let appToken: { token: string; expires_at: number } | null = null;

export async function getAppToken(): Promise<string> {
  if (appToken && appToken.expires_at - Date.now() > 60_000) {
    return appToken.token;
  }
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(`Client credentials request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  appToken = { token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return appToken.token;
}

async function apiFetch(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") || "1");
    await new Promise((r) => setTimeout(r, (retryAfter + 0.5) * 1000));
    return apiFetch(path, accessToken, init);
  }
  return res;
}

export async function getCurrentUser(accessToken: string): Promise<{ id: string; display_name: string | null }> {
  const res = await apiFetch("/me", accessToken);
  if (!res.ok) throw new Error(`Failed to fetch current user: ${res.status}`);
  const data = await res.json();
  return { id: data.id, display_name: data.display_name };
}

export async function searchTrack(accessToken: string, track: Track): Promise<string | null> {
  const attempts = [
    `track:${sanitize(track.title)} artist:${sanitize(track.artist)}`,
    `${track.title} ${track.artist}`,
  ];
  for (const q of attempts) {
    const params = new URLSearchParams({ q, type: "track", limit: "1" });
    const res = await apiFetch(`/search?${params.toString()}`, accessToken);
    if (!res.ok) continue;
    const data = await res.json();
    const item = data?.tracks?.items?.[0];
    if (item?.uri) return item.uri as string;
  }
  return null;
}

function sanitize(value: string): string {
  return value.replace(/["]/g, "").trim();
}

export async function createPlaylist(
  accessToken: string,
  name: string,
  isPublic: boolean
): Promise<{ id: string; url: string }> {
  const res = await apiFetch(`/me/playlists`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      name,
      public: isPublic,
      description: "Imported with the self-hosted playlist transfer tool.",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create playlist: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, url: data.external_urls?.spotify || `https://open.spotify.com/playlist/${data.id}` };
}

export async function addTracksToPlaylist(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const res = await apiFetch(`/playlists/${playlistId}/items`, accessToken, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
    if (!res.ok) throw new Error(`Failed to add tracks: ${res.status} ${await res.text()}`);
  }
}

export function extractSpotifyPlaylistId(url: string): string | null {
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export async function fetchPublicSpotifyPlaylist(url: string): Promise<{ name: string; tracks: Track[] }> {
  const id = extractSpotifyPlaylistId(url);
  if (!id) throw new Error("Could not find a playlist ID in that Spotify URL.");
  const token = await getAppToken();

  const metaRes = await fetch(`${API_BASE}/playlists/${id}?fields=name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error("That Spotify playlist could not be read. Make sure it's public.");
  const meta = await metaRes.json();

  const tracks: Track[] = [];
  let nextUrl: string | null = `${API_BASE}/playlists/${id}/items?limit=100&fields=items(item(name,artists(name),album(name))),next`;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) {
      throw new Error(
        "Spotify only allows reading the contents of playlists you own or collaborate on (a restriction added in 2026). " +
          "Use 'Paste a track list' instead for playlists belonging to someone else."
      );
    }
    if (!res.ok) throw new Error("Failed to read playlist tracks from Spotify.");
    const data: { items?: Array<{ item?: { name: string; artists?: { name: string }[]; album?: { name: string } } }>; next?: string | null } =
      await res.json();
    for (const entry of data.items || []) {
      const t = entry.item;
      if (!t) continue;
      tracks.push({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(", "),
        album: t.album?.name,
      });
    }
    nextUrl = data.next ?? null;
  }

  return { name: meta.name || "Imported playlist", tracks };
}
