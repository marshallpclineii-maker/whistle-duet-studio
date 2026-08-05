CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- tracks
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'youtube_music',
  title TEXT NOT NULL,
  artist TEXT,
  external_id TEXT,
  url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tracks_user_idx ON public.tracks(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks TO authenticated;
GRANT ALL ON public.tracks TO service_role;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tracks" ON public.tracks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- takes
CREATE TABLE public.takes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  track_id UUID REFERENCES public.tracks ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled take',
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  track_position_ms INTEGER,
  auto_detected BOOLEAN NOT NULL DEFAULT false,
  pitch_data JSONB,
  peaks JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX takes_user_idx ON public.takes(user_id, created_at DESC);
CREATE INDEX takes_track_idx ON public.takes(track_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.takes TO authenticated;
GRANT ALL ON public.takes TO service_role;
ALTER TABLE public.takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own takes" ON public.takes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New session',
  bpm INTEGER NOT NULL DEFAULT 120,
  master_effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_idx ON public.projects(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- studio tracks
CREATE TABLE public.studio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Track',
  order_index INTEGER NOT NULL DEFAULT 0,
  volume REAL NOT NULL DEFAULT 1,
  pan REAL NOT NULL DEFAULT 0,
  muted BOOLEAN NOT NULL DEFAULT false,
  soloed BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT 'amber',
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX studio_tracks_project_idx ON public.studio_tracks(project_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_tracks TO authenticated;
GRANT ALL ON public.studio_tracks TO service_role;
ALTER TABLE public.studio_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own studio tracks" ON public.studio_tracks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

-- clips
CREATE TABLE public.project_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_track_id UUID NOT NULL REFERENCES public.studio_tracks ON DELETE CASCADE,
  take_id UUID REFERENCES public.takes ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Clip',
  start_ms INTEGER NOT NULL DEFAULT 0,
  offset_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  gain REAL NOT NULL DEFAULT 1,
  fade_in_ms INTEGER NOT NULL DEFAULT 0,
  fade_out_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_clips_track_idx ON public.project_clips(studio_track_id, start_ms);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_clips TO authenticated;
GRANT ALL ON public.project_clips TO service_role;
ALTER TABLE public.project_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clips" ON public.project_clips FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_tracks st JOIN public.projects p ON p.id = st.project_id
                 WHERE st.id = studio_track_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.studio_tracks st JOIN public.projects p ON p.id = st.project_id
                 WHERE st.id = studio_track_id AND p.user_id = auth.uid()));

-- presets
CREATE TABLE public.presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presets TO authenticated;
GRANT ALL ON public.presets TO service_role;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presets" ON public.presets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);