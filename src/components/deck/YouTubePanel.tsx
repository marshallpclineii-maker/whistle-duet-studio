import { useEffect, useRef, useState } from "react";
import { Music2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseYouTubeId, thumbnailFor } from "@/lib/youtube";

export interface NowPlaying {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  positionMs: number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, cfg: Record<string, unknown>) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  getCurrentTime: () => number;
  getVideoData: () => { title: string; author: string; video_id: string };
  loadVideoById: (id: string) => void;
  destroy: () => void;
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * In-app YouTube / YouTube Music player. When you play a song here, every take
 * is automatically stamped with the exact video and playback position.
 */
export function YouTubePanel({
  onNowPlaying,
}: {
  onNowPlaying: (np: NowPlaying | null) => void;
}) {
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const cbRef = useRef(onNowPlaying);
  cbRef.current = onNowPlaying;

  useEffect(() => {
    if (!videoId) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void loadYouTubeApi().then(() => {
      if (cancelled || !holderRef.current || !window.YT) return;
      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(holderRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0 },
      });
      timer = setInterval(() => {
        const p = playerRef.current;
        if (!p?.getVideoData) return;
        try {
          const d = p.getVideoData();
          if (!d?.video_id) return;
          cbRef.current({
            videoId: d.video_id,
            title: d.title,
            author: d.author,
            thumbnail: thumbnailFor(d.video_id),
            positionMs: Math.round((p.getCurrentTime() || 0) * 1000),
          });
        } catch {
          /* player not ready */
        }
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      playerRef.current?.destroy();
      playerRef.current = null;
      cbRef.current(null);
    };
  }, [videoId]);

  const load = () => {
    const id = parseYouTubeId(input);
    if (id) setVideoId(id);
  };

  return (
    <div className="panel brushed p-4">
      <div className="mb-3 flex items-center gap-2">
        <Music2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest">In-app player</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">auto-tags takes</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Paste a YouTube or YouTube Music link"
          className="bg-rail readout text-xs"
          aria-label="YouTube link"
        />
        <Button onClick={load} variant="secondary" size="icon" aria-label="Load track">
          <Link2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 aspect-video w-full overflow-hidden rounded-md border border-border bg-rail">
        {videoId ? (
          <div ref={holderRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
            Play the song here and every whistle take is stamped with the exact track and
            timestamp — no typing. Or keep playing in your YouTube Music app and confirm the
            track when the deck prompts you.
          </div>
        )}
      </div>
    </div>
  );
}
