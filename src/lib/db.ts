import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Track = Tables<"tracks">;
export type Take = Tables<"takes">;
export type Project = Tables<"projects">;
export type StudioTrack = Tables<"studio_tracks">;
export type ProjectClip = Tables<"project_clips">;

export type TakeWithTrack = Take & { tracks: Track | null };

export async function listTakes(): Promise<TakeWithTrack[]> {
  const { data, error } = await supabase
    .from("takes")
    .select("*, tracks(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TakeWithTrack[];
}

export async function listTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function findOrCreateTrack(input: {
  title: string;
  artist?: string | null;
  source: string;
  external_id?: string | null;
  url?: string | null;
  thumbnail_url?: string | null;
}): Promise<Track> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  if (input.external_id) {
    const { data: existing } = await supabase
      .from("tracks")
      .select("*")
      .eq("external_id", input.external_id)
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
  }
  const { data, error } = await supabase
    .from("tracks")
    .insert({
      user_id: userId,
      title: input.title,
      artist: input.artist ?? null,
      source: input.source,
      external_id: input.external_id ?? null,
      url: input.url ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadTake(params: {
  blob: Blob;
  durationMs: number;
  trackId: string | null;
  trackPositionMs: number | null;
  autoDetected: boolean;
  peaks: number[];
  pitchData: number[];
  title: string;
}): Promise<Take> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const ext = params.blob.type.includes("mp4") ? "m4a" : "webm";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("recordings")
    .upload(path, params.blob, { contentType: params.blob.type || "audio/webm" });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("takes")
    .insert({
      user_id: userId,
      track_id: params.trackId,
      title: params.title,
      storage_path: path,
      mime_type: params.blob.type || "audio/webm",
      duration_ms: Math.round(params.durationMs),
      track_position_ms: params.trackPositionMs,
      auto_detected: params.autoDetected,
      peaks: params.peaks,
      pitch_data: params.pitchData,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function takeUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("recordings")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteTake(take: Take): Promise<void> {
  await supabase.storage.from("recordings").remove([take.storage_path]);
  const { error } = await supabase.from("takes").delete().eq("id", take.id);
  if (error) throw error;
}

export async function renameTake(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("takes").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string): Promise<Project> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("studio_tracks").insert([
    { project_id: data.id, name: "Whistle 1", order_index: 0, color: "amber" },
    { project_id: data.id, name: "Whistle 2", order_index: 1, color: "green" },
  ]);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export interface FullProject {
  project: Project;
  tracks: (StudioTrack & { clips: (ProjectClip & { take: Take | null })[] })[];
}

export async function loadProject(id: string): Promise<FullProject> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: tracks, error: tErr } = await supabase
    .from("studio_tracks")
    .select("*")
    .eq("project_id", id)
    .order("order_index");
  if (tErr) throw tErr;

  const trackIds = (tracks ?? []).map((t) => t.id);
  let clips: (ProjectClip & { takes: Take | null })[] = [];
  if (trackIds.length) {
    const { data: c, error: cErr } = await supabase
      .from("project_clips")
      .select("*, takes(*)")
      .in("studio_track_id", trackIds)
      .order("start_ms");
    if (cErr) throw cErr;
    clips = (c ?? []) as (ProjectClip & { takes: Take | null })[];
  }

  return {
    project,
    tracks: (tracks ?? []).map((t) => ({
      ...t,
      clips: clips
        .filter((c) => c.studio_track_id === t.id)
        .map((c) => ({ ...c, take: c.takes })),
    })),
  };
}
