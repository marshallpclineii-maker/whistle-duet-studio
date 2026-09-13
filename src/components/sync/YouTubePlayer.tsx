import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type YouTubeController = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  currentTime: () => number;
};

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (value: number) => void;
  getCurrentTime: () => number;
  loadVideoById: (id: string) => void;
  destroy: () => void;
};

type YTGlobal = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void };
    },
  ) => YTPlayer;
};

let apiPromise: Promise<YTGlobal> | null = null;

function loadYouTubeApi(): Promise<YTGlobal> {
  const w = window as unknown as { YT?: YTGlobal; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!apiPromise) {
    apiPromise = new Promise<YTGlobal>((resolve) => {
      w.onYouTubeIframeAPIReady = () => resolve((window as unknown as { YT: YTGlobal }).YT);
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return url.pathname.slice(1, 12) || null;
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/");
    const last = parts[parts.length - 1];
    return last && last.length === 11 ? last : null;
  } catch {
    return null;
  }
}

export function YouTubePlayer({
  videoId,
  controllerRef,
}: {
  videoId: string | null;
  controllerRef?: Ref<YouTubeController>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hostRef.current) return;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current || playerRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!videoId) return;
    const id = window.setInterval(() => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(videoId);
        playerRef.current.pauseVideo?.();
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [videoId]);

  useImperativeHandle(
    controllerRef,
    () => ({
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seek: (seconds: number) => playerRef.current?.seekTo?.(seconds, true),
      setVolume: (value: number) => playerRef.current?.setVolume?.(value),
      currentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
    }),
    [],
  );

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
