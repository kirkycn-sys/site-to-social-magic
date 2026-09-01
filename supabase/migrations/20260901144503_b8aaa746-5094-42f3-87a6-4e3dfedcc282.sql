CREATE TABLE public.brand_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  phone text,
  logo_path text,
  accent_color text NOT NULL DEFAULT '#c8f751',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO authenticated;
GRANT ALL ON public.brand_profiles TO service_role;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand profile"
ON public.brand_profiles FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_brand_profiles_updated_at
BEFORE UPDATE ON public.brand_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  site_title text,
  headline text,
  prompt text,
  job_id text,
  status text NOT NULL DEFAULT 'processing',
  error text,
  storage_path text,
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX videos_user_created_idx ON public.videos (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own videos"
ON public.videos FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer)
RETURNS TABLE (allowed boolean, credits integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.user_credits;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  INSERT INTO public.user_credits (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO rec FROM public.user_credits WHERE user_id = uid FOR UPDATE;

  IF rec.credits >= _amount THEN
    UPDATE public.user_credits SET credits = rec.credits - _amount
      WHERE user_id = uid RETURNING * INTO rec;
    RETURN QUERY SELECT true, rec.credits;
  ELSE
    RETURN QUERY SELECT false, rec.credits;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  UPDATE public.user_credits SET credits = credits + _amount WHERE user_id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_credits(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer) TO authenticated;