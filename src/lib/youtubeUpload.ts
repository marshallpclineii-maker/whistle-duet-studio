/**
 * Per-user YouTube access via Google Identity Services.
 * The client ID is a public value; set VITE_YOUTUBE_CLIENT_ID to enable uploads.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

const GIS_SRC = "https://accounts.google.com/gsi/client";

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };

type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};

export function youtubeClientId(): string {
  return (import.meta.env["VITE_YOUTUBE_CLIENT_ID"] as string | undefined) ?? "";
}

export function youtubeConfigured(): boolean {
  return youtubeClientId().length > 0;
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if ((window as unknown as { google?: GoogleGlobal }).google) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Google sign-in"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

const TOKEN_KEY = "whistle.youtube.token";

export function storedToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token: string; expires: number };
    if (parsed.expires < Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  window.sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ token, expires: Date.now() + 55 * 60 * 1000 }),
  );
}

export function clearToken() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(TOKEN_KEY);
}

/** Opens Google consent and resolves with an access token carrying YouTube scopes. */
export async function connectYouTube(): Promise<string> {
  const clientId = youtubeClientId();
  if (!clientId) throw new Error("YouTube is not configured yet.");
  await loadGis();
  const google = (window as unknown as { google: GoogleGlobal }).google;

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Consent was cancelled"));
          return;
        }
        storeToken(response.access_token);
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: storedToken() ? "" : "consent" });
  });
}

export type ChannelInfo = { id: string; title: string; thumbnail: string | null };

export async function fetchMyChannel(token: string): Promise<ChannelInfo | null> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(await response.text());
  const json = (await response.json()) as {
    items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } } }[];
  };
  const item = json.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url ?? null,
  };
}

export type UploadMetadata = {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "private" | "unlisted" | "public";
};

export async function uploadToYouTube(
  token: string,
  media: Blob,
  metadata: UploadMetadata,
): Promise<{ id: string }> {
  const body = new FormData();
  body.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: "10",
          },
          status: { privacyStatus: metadata.privacyStatus },
        }),
      ],
      { type: "application/json" },
    ),
  );
  body.append("file", media);

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
  );
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { id: string };
}
