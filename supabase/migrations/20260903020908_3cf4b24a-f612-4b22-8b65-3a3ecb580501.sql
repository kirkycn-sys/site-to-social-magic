CREATE OR REPLACE FUNCTION public.consume_generation_credit()
 RETURNS TABLE(allowed boolean, source text, credits integer, free_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rec public.user_credits;
  free_total constant integer := 3;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_credits (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO rec FROM public.user_credits WHERE user_id = uid FOR UPDATE;

  IF rec.free_used_today < free_total THEN
    UPDATE public.user_credits
      SET free_used_today = rec.free_used_today + 1
      WHERE user_id = uid
      RETURNING * INTO rec;
    RETURN QUERY SELECT true, 'free'::text, rec.credits, GREATEST(free_total - rec.free_used_today, 0);
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
$function$;

CREATE OR REPLACE FUNCTION public.get_credit_status(_user_id uuid)
 RETURNS TABLE(credits integer, free_remaining integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec public.user_credits;
  free_total constant integer := 3;
BEGIN
  SELECT * INTO rec FROM public.user_credits WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, free_total;
  ELSE
    RETURN QUERY SELECT rec.credits, GREATEST(free_total - rec.free_used_today, 0);
  END IF;
END;
$function$;