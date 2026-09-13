import { supabase } from "@/integrations/supabase/client";
import type { Arrangement } from "./audio/arrangement";

export type SessionRow = {
  id: string;
  title: string;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_artist: string | null;
  arrangement: Arrangement;
  mixdown_path: string | null;
  duration_seconds: number;
  uploaded_video_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SessionRow[];
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as SessionRow | null;
}

export async function createSession(userId: string, title = "Untitled session") {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, title })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as SessionRow;
}

export type SessionPatch = Partial<{
  title: string;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_artist: string | null;
  arrangement: unknown;
  mixdown_path: string | null;
  duration_seconds: number;
  uploaded_video_id: string | null;
}>;

export async function updateSession(id: string, patch: SessionPatch) {
  const { error } = await supabase
    .from("sessions")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadAudio(path: string, blob: Blob) {
  const { error } = await supabase.storage
    .from("recordings")
    .upload(path, blob, { upsert: true, contentType: blob.type || "audio/wav" });
  if (error) throw error;
  return path;
}

export async function downloadAudio(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("recordings").download(path);
  if (error) throw error;
  return data;
}

export async function signedAudioUrl(path: string, seconds = 3600) {
  const { data, error } = await supabase.storage.from("recordings").createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
