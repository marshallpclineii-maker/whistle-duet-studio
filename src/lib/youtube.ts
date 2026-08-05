/** YouTube / YouTube Music link parsing and metadata lookup. */

export type TrackSource = "youtube_music" | "youtube" | "pandora" | "spotify" | "other";

export const SOURCE_LABELS: Record<TrackSource, string> = {
  youtube_music: "YouTube Music",
  youtube: "YouTube",
  pandora: "Pandora",
  spotify: "Spotify",
  other: "Other",
};

export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (host.endsWith("youtube.com") || host.endsWith("music.youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = url.pathname.match(/\/(embed|shorts|v)\/([\w-]{11})/);
      if (m) return m[2]!;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function sourceFromUrl(input: string): TrackSource {
  const s = input.toLowerCase();
  if (s.includes("music.youtube")) return "youtube_music";
  if (s.includes("youtube") || s.includes("youtu.be")) return "youtube";
  if (s.includes("pandora")) return "pandora";
  if (s.includes("spotify")) return "spotify";
  return "other";
}

export function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export interface OEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export async function fetchYouTubeMeta(videoId: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}
