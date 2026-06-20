# Transfer Manifest

A self-hosted playlist transfer tool. Paste a playlist link from Spotify, Apple
Music, or YouTube/YouTube Music (or paste a plain track list from anywhere
else — Tidal, Deezer, SoundCloud, a handwritten list), and it rebuilds the
playlist as a new playlist in your own Spotify account.

It's a Next.js app meant to be deployed on **your own Vercel account**. There's
no shared backend, no database, and no third party sees your Spotify tokens —
they live only in an encrypted cookie in your browser.

## How matching works

For each track in the source playlist, the app searches the Spotify catalog
by title + artist and takes the best match. Tracks that can't be found are
listed at the end so you can add them by hand. There's no perfect 1:1 catalog
between services, so expect occasional misses, especially for live versions,
remixes, or regional-only releases.

## What's supported out of the box

| Source                  | How it reads the playlist                              |
|--------------------------|--------------------------------------------------------|
| Spotify (public playlist)| Official Spotify Web API — reliable                    |
| YouTube / YouTube Music | Official YouTube Data API v3 — needs a free API key    |
| Apple Music (public)    | Reads the public playlist webpage — best-effort, see note below |
| Anything else           | Paste a plain text track list (`Artist - Title` per line) |

**A note on Apple Music:** Apple doesn't offer a public API for reading
playlists, so this app scrapes the structure embedded in the public web
player page. Apple changes that page's markup from time to time, so if a
link stops working, that's expected — use the "paste a track list" option
instead, which always works for any source.

## Spotify's 2026 Developer Mode restrictions

Spotify rolled out new restrictions for apps in Development Mode in
February/March 2026. A few things worth knowing if you hit a 403:

- **The app owner's Spotify account needs an active Premium subscription.**
  Development Mode apps stop working entirely on a Free account.
- **Up to 5 users per app.** Make sure the Spotify account you're logging in
  with is added under your app's **Users and Access** section in the
  [developer dashboard](https://developer.spotify.com/dashboard) — this is a
  separate setting from the Redirect URI.
- **Reading someone else's public playlist is restricted.** Spotify's own
  playlist-items endpoint now only returns track data for playlists you own
  or collaborate on. This app's "paste a track list" option is the reliable
  way around that for playlists you don't own — pulling tracks from a
  playlist of your own should still work fine.

## 1. Create a Spotify Developer App

1. Go to <https://developer.spotify.com/dashboard> and log in with your
   Spotify account.
2. Click **Create app**.
3. Fill in any name/description.
4. For **Redirect URI**, add both, so it works locally and once deployed:
   - `http://127.0.0.1:3000/api/auth/callback`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback`
   (you can add the production one after your first deploy, then redeploy)
5. Save, then open the app's **Settings** to copy your **Client ID** and
   **Client Secret**.

## 2. (Optional) Get a YouTube Data API key

Only needed if you want to read YouTube / YouTube Music playlists directly
instead of pasting a track list.

1. Go to <https://console.cloud.google.com/>, create a project (or use an
   existing one).
2. Enable the **YouTube Data API v3** for that project.
3. Create an API key under **APIs & Services → Credentials**.

## 3. Generate a session secret

This encrypts the cookie that holds your Spotify tokens. Run:

```bash
openssl rand -hex 32
```

## 4. Run it locally (optional, to test before deploying)

```bash
npm install
cp .env.example .env.local
# fill in .env.local with the values from steps 1–3
npm run dev
```

Open <http://127.0.0.1:3000>.

## 5. Deploy to Vercel

```bash
npm install -g vercel   # if you don't already have it
vercel
```

Follow the prompts to link/create a project. Then add your environment
variables — either via the CLI:

```bash
vercel env add SPOTIFY_CLIENT_ID
vercel env add SPOTIFY_CLIENT_SECRET
vercel env add SPOTIFY_REDIRECT_URI   # https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback
vercel env add SESSION_SECRET
vercel env add YOUTUBE_API_KEY        # optional
```

or via the Vercel dashboard under **Project → Settings → Environment
Variables**. Then deploy to production:

```bash
vercel --prod
```

Once you have your real `https://your-app.vercel.app` domain, double check
it's also added as a Redirect URI on your Spotify app (step 1), and that
`SPOTIFY_REDIRECT_URI` matches it exactly.

## Project structure

```
app/
  page.tsx                 # the UI: paste link → review tracks → connect → transfer
  api/auth/login           # starts Spotify OAuth
  api/auth/callback        # exchanges the OAuth code for tokens, sets the session cookie
  api/auth/status          # reports whether you're connected, refreshes tokens if needed
  api/auth/logout          # clears the session cookie
  api/parse                # detects the source platform and extracts a track list
  api/transfer             # searches Spotify for matches and creates the new playlist
lib/
  spotify.ts               # Spotify OAuth + Web API helpers
  session.ts               # AES-256-GCM cookie encryption for tokens
  parsers/
    appleMusic.ts           # best-effort Apple Music page scraper
    youtube.ts               # YouTube Data API v3 reader
    manual.ts                # plain-text track list parser
    detect.ts                 # URL → platform detection
```

## Notes / limitations

- Only **public** playlists can be read from Spotify, Apple Music, or
  YouTube — there's no login flow for the *source* platform, only for the
  Spotify *destination*.
- The new playlist is created as **private** by default; check the box in
  the UI to make it public.
- Matching is exact-search based, not fuzzy — for tricky catalogs (classical
  music, multiple versions of the same song, etc.) you may need to fix a few
  matches by hand afterward.
