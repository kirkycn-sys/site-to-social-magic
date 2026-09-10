
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_generation_credit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_generation_credit(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_credit_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
