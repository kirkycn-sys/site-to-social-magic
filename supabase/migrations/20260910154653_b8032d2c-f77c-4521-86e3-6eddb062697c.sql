
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'kirkycn@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Owner bypass in credit functions
CREATE OR REPLACE FUNCTION public.consume_generation_credit()
RETURNS TABLE(allowed boolean, source text, credits integer, free_remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  rec public.user_credits;
  free_total constant integer := 3;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF public.has_role(uid, 'admin') THEN
    RETURN QUERY SELECT true, 'owner'::text, 999999, 999999;
    RETURN;
  END IF;

  INSERT INTO public.user_credits (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO rec FROM public.user_credits WHERE user_id = uid FOR UPDATE;

  IF rec.free_used_today < free_total THEN
    UPDATE public.user_credits SET free_used_today = rec.free_used_today + 1
      WHERE user_id = uid RETURNING * INTO rec;
    RETURN QUERY SELECT true, 'free'::text, rec.credits, GREATEST(free_total - rec.free_used_today, 0);
  ELSIF rec.credits > 0 THEN
    UPDATE public.user_credits SET credits = rec.credits - 1
      WHERE user_id = uid RETURNING * INTO rec;
    RETURN QUERY SELECT true, 'credit'::text, rec.credits, 0;
  ELSE
    RETURN QUERY SELECT false, 'none'::text, rec.credits, 0;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_generation_credit(_source text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _source = 'owner' THEN RETURN; END IF;
  IF _source = 'free' THEN
    UPDATE public.user_credits SET free_used_today = GREATEST(free_used_today - 1, 0) WHERE user_id = uid;
  ELSIF _source = 'credit' THEN
    UPDATE public.user_credits SET credits = credits + 1 WHERE user_id = uid;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer)
RETURNS TABLE(allowed boolean, credits integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  rec public.user_credits;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  IF public.has_role(uid, 'admin') THEN
    RETURN QUERY SELECT true, 999999;
    RETURN;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  IF public.has_role(uid, 'admin') THEN RETURN; END IF;
  UPDATE public.user_credits SET credits = credits + _amount WHERE user_id = uid;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_credit_status(uuid);
CREATE OR REPLACE FUNCTION public.get_credit_status(_user_id uuid)
RETURNS TABLE(credits integer, free_remaining integer, unlimited boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  rec public.user_credits;
  free_total constant integer := 3;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN QUERY SELECT 999999, 999999, true;
    RETURN;
  END IF;
  SELECT * INTO rec FROM public.user_credits WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, free_total, false;
  ELSE
    RETURN QUERY SELECT rec.credits, GREATEST(free_total - rec.free_used_today, 0), false;
  END IF;
END;
$function$;
