CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled session',
  youtube_video_id TEXT,
  youtube_title TEXT,
  youtube_artist TEXT,
  arrangement JSONB NOT NULL DEFAULT '{"tracks":[],"buffers":[]}'::jsonb,
  mixdown_path TEXT,
  duration_seconds NUMERIC NOT NULL DEFAULT 0,
  uploaded_video_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sessions" ON public.sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX sessions_user_id_updated_at_idx ON public.sessions (user_id, updated_at DESC);

CREATE TRIGGER sessions_set_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();