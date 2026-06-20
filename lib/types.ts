export type Track = {
  title: string;
  artist: string;
  album?: string;
};

export type ParseResult = {
  platform: "spotify" | "apple-music" | "youtube" | "manual";
  sourceName: string;
  tracks: Track[];
};

export type TransferResult = {
  playlistUrl: string;
  playlistName: string;
  total: number;
  matched: Track[];
  unmatched: Track[];
};
