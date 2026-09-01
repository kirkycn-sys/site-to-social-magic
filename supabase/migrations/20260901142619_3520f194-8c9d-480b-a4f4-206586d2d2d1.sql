REVOKE EXECUTE ON FUNCTION public.get_credit_status(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_generation_credit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_generation_credit(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_generation_credit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credit(text) TO authenticated;