"use client";

import { useEffect, useState } from "react";
import { ParseResult, Track, TransferResult } from "@/lib/types";

type AuthStatus = { loggedIn: boolean; user?: { id: string; display_name: string | null } };

const PLATFORM_LABEL: Record<ParseResult["platform"], string> = {
  spotify: "Spotify",
  "apple-music": "Apple Music",
  youtube: "YouTube / YouTube Music",
  manual: "Pasted list",
};

export default function Page() {
  const [mode, setMode] = useState<"link" | "manual">("link");
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const [auth, setAuth] = useState<AuthStatus | null>(null);

  const [playlistName, setPlaylistName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  async function refreshAuthStatus() {
    const res = await fetch("/api/auth/status");
    const data = await res.json();
    setAuth(data);
  }

  async function handleParse() {
    setParsing(true);
    setParseError(null);
    setParseResult(null);
    setTransferResult(null);
    setTransferError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "link" ? { url } : { manualText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || "Couldn't read that playlist.");
        return;
      }
      setParseResult(data);
      setPlaylistName(data.sourceName);
    } catch {
      setParseError("Couldn't reach the server. Try again.");
    } finally {
      setParsing(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/auth/logout", { method: "POST" });
    refreshAuthStatus();
  }

  async function handleTransfer() {
    if (!parseResult) return;
    setTransferring(true);
    setTransferError(null);
    setTransferResult(null);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: parseResult.tracks, playlistName, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransferError(data.error || "Transfer failed.");
        return;
      }
      setTransferResult(data);
    } catch {
      setTransferError("Couldn't reach the server. Try again.");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">No. 001 · Self-hosted</p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Transfer Manifest</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-paper/70">
            Hand over a playlist link from anywhere. Get a track-for-track copy in your own Spotify account.
          </p>
        </header>

        {/* SOURCE CARD */}
        <section className="rounded-sm bg-paper text-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
            <span className="font-display text-sm font-bold uppercase tracking-wide">Origin</span>
            <span className="font-mono text-xs text-ink/50">step 1 of 2</span>
          </div>

          <div className="px-6 py-5">
            <div className="mb-4 flex gap-2 font-mono text-xs uppercase tracking-wide">
              <button
                onClick={() => setMode("link")}
                className={`rounded-sm px-3 py-1.5 ${mode === "link" ? "bg-ink text-paper" : "bg-ink/5 text-ink/60"}`}
              >
                Paste a link
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`rounded-sm px-3 py-1.5 ${mode === "manual" ? "bg-ink text-paper" : "bg-ink/5 text-ink/60"}`}
              >
                Paste a track list
              </button>
            </div>

            {mode === "link" ? (
              <div>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://music.apple.com/.../playlist/..."
                  className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-brass"
                />
                <p className="mt-2 text-xs text-ink/50">
                  Works with public links from Spotify, Apple Music, and YouTube / YouTube Music.
                </p>
              </div>
            ) : (
              <div>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={"Artist - Title\nAnother Artist - Another Title"}
                  rows={6}
                  className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-brass"
                />
                <p className="mt-2 text-xs text-ink/50">
                  One track per line. Use this for Tidal, Deezer, SoundCloud, or anything without a built-in reader.
                </p>
              </div>
            )}

            {parseError && (
              <div className="mt-3 rounded-sm border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">
                {parseError}
              </div>
            )}

            <button
              onClick={handleParse}
              disabled={parsing || (mode === "link" ? !url.trim() : !manualText.trim())}
              className="mt-4 w-full rounded-sm bg-brass py-2.5 font-display text-sm font-bold uppercase tracking-wide text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {parsing ? "Reading…" : "Read playlist"}
            </button>
          </div>

          {parseResult && (
            <>
              <div className="perforation" />
              <div className="px-6 py-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-bold">{parseResult.sourceName}</h2>
                  <span className="font-mono text-xs uppercase text-ink/50">
                    {PLATFORM_LABEL[parseResult.platform]} · {parseResult.tracks.length} tracks
                  </span>
                </div>
                <TrackManifest tracks={parseResult.tracks} />
              </div>
            </>
          )}
        </section>

        <div className="my-6 flex items-center justify-center">
          <div className="h-px w-full border-t border-dashed border-paper/20" />
          <span className="px-3 font-mono text-xs uppercase tracking-widest text-paper/40">to</span>
          <div className="h-px w-full border-t border-dashed border-paper/20" />
        </div>

        {/* DESTINATION CARD */}
        <section className="rounded-sm bg-paper text-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
            <span className="font-display text-sm font-bold uppercase tracking-wide">Destination · Spotify</span>
            <span className="font-mono text-xs text-ink/50">step 2 of 2</span>
          </div>

          <div className="px-6 py-5">
            {auth === null ? (
              <p className="text-sm text-ink/50">Checking connection…</p>
            ) : auth.loggedIn ? (
              <div className="flex items-center justify-between rounded-sm bg-sage/10 px-3 py-2.5 text-sm">
                <span>
                  Connected as <strong>{auth.user?.display_name || auth.user?.id}</strong>
                </span>
                <button onClick={handleDisconnect} className="font-mono text-xs uppercase text-ink/50 underline">
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/login"
                className="block w-full rounded-sm bg-[#1DB954] py-2.5 text-center font-display text-sm font-bold uppercase tracking-wide text-ink"
              >
                Connect Spotify
              </a>
            )}

            <div className="mt-4">
              <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-ink/50">
                New playlist name
              </label>
              <input
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Untitled manifest"
                className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-brass"
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Make this playlist public
            </label>

            {transferError && (
              <div className="mt-3 rounded-sm border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">
                {transferError}
              </div>
            )}

            <button
              onClick={handleTransfer}
              disabled={!parseResult || !auth?.loggedIn || transferring || !playlistName.trim()}
              className="mt-4 w-full rounded-sm bg-ink py-2.5 font-display text-sm font-bold uppercase tracking-wide text-paper transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              {transferring ? "Transferring…" : "Transfer to Spotify"}
            </button>
          </div>

          {transferResult && (
            <>
              <div className="perforation" />
              <div className="px-6 py-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-block -rotate-3 rounded-sm border-2 border-sage px-3 py-1 font-display text-sm font-bold uppercase tracking-wider text-sage">
                    Transferred
                  </span>
                  <a
                    href={transferResult.playlistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs uppercase tracking-wide text-ink underline"
                  >
                    Open in Spotify →
                  </a>
                </div>
                <p className="text-sm text-ink/70">
                  Matched <strong>{transferResult.matched.length}</strong> of{" "}
                  <strong>{transferResult.total}</strong> tracks into <strong>{transferResult.playlistName}</strong>.
                </p>

                {transferResult.unmatched.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 font-mono text-xs uppercase tracking-wide text-rust">
                      Not found on Spotify ({transferResult.unmatched.length})
                    </p>
                    <TrackManifest tracks={transferResult.unmatched} muted />
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="mt-10 text-center font-mono text-xs leading-relaxed text-paper/40">
          Self-hosted — runs on your own Vercel deployment with your own Spotify app credentials.
          <br />
          Your Spotify tokens live only in an encrypted browser cookie, never in a database.
        </footer>
      </div>
    </main>
  );
}

function TrackManifest({ tracks, muted }: { tracks: Track[]; muted?: boolean }) {
  return (
    <ol className="max-h-72 space-y-1 overflow-y-auto font-mono text-sm">
      {tracks.map((t, i) => (
        <li
          key={`${t.title}-${t.artist}-${i}`}
          className={`flex gap-3 border-b border-ink/5 py-1.5 last:border-0 ${muted ? "text-rust" : "text-ink/80"}`}
        >
          <span className="w-6 shrink-0 text-right text-ink/30">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate">
            {t.artist ? <span className="text-ink/50">{t.artist} — </span> : null}
            {t.title}
          </span>
        </li>
      ))}
    </ol>
  );
}
