export interface BackingTrackSource {
  readonly duration: number;
  readonly currentTime: number;
  readonly loaded: boolean;

  load(url: string): Promise<void>;

  play(offset?: number): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;

  setVolume(value: number): void;

  connect(destination: AudioNode): void;
  disconnect(): void;

  dispose(): void;
}

export class HtmlBackingTrackSource implements BackingTrackSource {
  private readonly audio: HTMLAudioElement;
  private readonly source: MediaElementAudioSourceNode;

  constructor(private readonly context: AudioContext) {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.crossOrigin = "anonymous";

    this.source = context.createMediaElementSource(this.audio);
  }

  get duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get loaded(): boolean {
    return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  async load(url: string): Promise<void> {
    this.audio.src = url;
    this.audio.load();

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error("Could not load backing track."));
      };

      const cleanup = () => {
        this.audio.removeEventListener("canplay", onReady);
        this.audio.removeEventListener("error", onError);
      };

      this.audio.addEventListener("canplay", onReady, { once: true });
      this.audio.addEventListener("error", onError, { once: true });
    });
  }

  play(offset?: number): void {
    if (offset !== undefined) {
      this.seek(offset);
    }

    void this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(seconds: number): void {
    this.audio.currentTime = Math.max(0, seconds);
  }

  setVolume(value: number): void {
    this.audio.volume = Math.min(1, Math.max(0, value));
  }

  connect(destination: AudioNode): void {
    this.source.connect(destination);
  }

  disconnect(): void {
    this.source.disconnect();
  }

  dispose(): void {
    this.pause();
    this.source.disconnect();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
