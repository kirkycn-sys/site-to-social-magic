CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 0,
  free_used_today integer NOT NULL DEFAULT 0,
  free_reset_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits"
ON public.user_credits FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily free allowance
CREATE OR REPLACE FUNCTION public.get_credit_status(_user_id uuid)
RETURNS TABLE (credits integer, free_remaining integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.user_credits;
  daily_free constant integer := 3;
BEGIN
  SELECT * INTO rec FROM public.user_credits WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, daily_free;
  ELSIF rec.free_reset_date < (now() AT TIME ZONE 'utc')::date THEN
    RETURN QUERY SELECT rec.credits, daily_free;
  ELSE
    RETURN QUERY SELECT rec.credits, GREATEST(daily_free - rec.free_used_today, 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_generation_credit()
RETURNS TABLE (allowed boolean, source text, credits integer, free_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.user_credits;
  today date := (now() AT TIME ZONE 'utc')::date;
  daily_free constant integer := 3;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_credits (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO rec FROM public.user_credits WHERE user_id = uid FOR UPDATE;

  IF rec.free_reset_date < today THEN
    UPDATE public.user_credits
      SET free_used_today = 0, free_reset_date = today
      WHERE user_id = uid
      RETURNING * INTO rec;
  END IF;

  IF rec.free_used_today < daily_free THEN
    UPDATE public.user_credits
      SET free_used_today = rec.free_used_today + 1
      WHERE user_id = uid
      RETURNING * INTO rec;
    RETURN QUERY SELECT true, 'free'::text, rec.credits, GREATEST(daily_free - rec.free_used_today, 0);
  ELSIF rec.credits > 0 THEN
    UPDATE public.user_credits
      SET credits = rec.credits - 1
      WHERE user_id = uid
      RETURNING * INTO rec;
    RETURN QUERY SELECT true, 'credit'::text, rec.credits, 0;
  ELSE
    RETURN QUERY SELECT false, 'none'::text, rec.credits, 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_generation_credit(_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF _source = 'free' THEN
    UPDATE public.user_credits SET free_used_today = GREATEST(free_used_today - 1, 0) WHERE user_id = uid;
  ELSIF _source = 'credit' THEN
    UPDATE public.user_credits SET credits = credits + 1 WHERE user_id = uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_generation_credit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credit(text) TO authenticated;