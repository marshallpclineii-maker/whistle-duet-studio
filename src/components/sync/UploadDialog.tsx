import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Youtube } from "lucide-react";
import {
  connectYouTube,
  clearToken,
  fetchMyChannel,
  storedToken,
  uploadToYouTube,
  youtubeConfigured,
  type ChannelInfo,
} from "@/lib/youtube";

export function UploadDialog({
  open,
  onOpenChange,
  defaultTitle,
  buildMedia,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  buildMedia: () => Promise<Blob>;
  onUploaded: (videoId: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(
    "Recorded and mixed in Whistle — live whistling over a YouTube backing track.",
  );
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setToken(storedToken());
    }
  }, [open, defaultTitle]);

  useEffect(() => {
    if (!token) return;
    fetchMyChannel(token)
      .then(setChannel)
      .catch(() => {
        clearToken();
        setToken(null);
      });
  }, [token]);

  const connect = async () => {
    setBusy(true);
    try {
      setToken(await connectYouTube());
      toast.success("YouTube connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect YouTube");
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const media = await buildMedia();
      const result = await uploadToYouTube(token, media, {
        title,
        description,
        tags: ["whistle", "cover", "mix"],
        privacyStatus: privacy,
      });
      onUploaded(result.id);
      toast.success("Uploaded to YouTube");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-destructive" /> Publish to YouTube
          </DialogTitle>
          <DialogDescription>
            Whistle mixes every track down to a single audio file and uploads it with the YouTube
            Data API v3.
          </DialogDescription>
        </DialogHeader>

        {!youtubeConfigured() ? (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">YouTube uploads need a Google OAuth client</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Create an OAuth 2.0 Web client in the Google Cloud console.</li>
              <li>Enable the YouTube Data API v3 for that project.</li>
              <li>
                Add this app&apos;s origin to authorised JavaScript origins and request the
                <code className="mx-1">youtube.upload</code> and
                <code className="mx-1">youtube.readonly</code> scopes.
              </li>
              <li>
                Save the client ID as <code>VITE_YOUTUBE_CLIENT_ID</code>.
              </li>
            </ol>
          </div>
        ) : !token ? (
          <Button onClick={() => void connect()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect YouTube account
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {channel?.thumbnail ? (
                <img src={channel.thumbnail} alt="" className="h-6 w-6 rounded-full" />
              ) : null}
              <span>{channel?.title ?? "Connected"}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => {
                  clearToken();
                  setToken(null);
                  setChannel(null);
                }}
              >
                Disconnect
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-title">Title</Label>
              <Input id="yt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yt-desc">Description</Label>
              <Textarea
                id="yt-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void upload()} disabled={!token || busy || !title.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Mix &amp; upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
